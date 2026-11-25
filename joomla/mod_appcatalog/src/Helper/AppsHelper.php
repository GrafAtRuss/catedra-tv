<?php

/**
 * @package     AppCatalog.Module
 * @copyright   (C) 2026 Ермаков Алексей Сергеевич
 * @license     GNU General Public License version 2 or later; see LICENSE.txt
 */

namespace Ermakov\Module\AppCatalog\Site\Helper;

\defined('_JEXEC') or die;

use Joomla\CMS\Http\HttpFactory;

/**
 * Читает каталог приложений из XML.
 */
class AppsHelper
{
    public const DEFAULT_URL = 'https://raw.githubusercontent.com/GrafAtRuss/catedra-tv/main/versions.xml';

    /**
     * @return array{apps: list<object>, agreements: list<object>}
     */
    public function load(string $url, int $ttlMinutes): array
    {
        $raw = $this->fetch($url, $ttlMinutes);

        return $this->parse($raw);
    }

    private function fetch(string $url, int $ttlMinutes): string
    {
        $url = trim($url);

        if (!preg_match('#^https://#i', $url)) {
            throw new \RuntimeException('Catalog URL must be https.');
        }

        $path = $this->cacheFile($url);
        $ttl = max(0, $ttlMinutes) * 60;

        if ($path !== '' && $ttl > 0 && is_file($path) && (time() - (int) filemtime($path)) < $ttl) {
            $cached = file_get_contents($path);

            if (is_string($cached) && $cached !== '') {
                return $cached;
            }
        }

        try {
            $body = $this->download($url);
        } catch (\Throwable $error) {
            if ($path !== '' && is_file($path)) {
                $stale = file_get_contents($path);

                if (is_string($stale) && $stale !== '') {
                    return $stale;
                }
            }

            throw $error;
        }

        if ($path !== '') {
            file_put_contents($path, $body, LOCK_EX);
        }

        return $body;
    }

    private function download(string $url): string
    {
        $body = '';
        $code = 0;

        try {
            if (class_exists(HttpFactory::class)) {
                $http = HttpFactory::getHttp();
                $response = $http->get($url, ['User-Agent' => 'AppCatalog/1.0'], 20);
                $code = (int) ($response->code ?? 0);
                $body = (string) ($response->body ?? '');
            }
        } catch (\Throwable $error) {
            $body = '';
            $code = 0;
        }

        if ($code === 200 && $body !== '') {
            return $body;
        }

        $context = stream_context_create([
            'http' => [
                'timeout' => 20,
                'header' => "User-Agent: AppCatalog/1.0\r\nAccept: application/xml\r\n",
            ],
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
            ],
        ]);
        $raw = @file_get_contents($url, false, $context);

        if (is_string($raw) && $raw !== '') {
            return $raw;
        }

        throw new \RuntimeException('Catalog download failed.');
    }

    /**
     * @return array{apps: list<object>, agreements: list<object>}
     */
    private function parse(string $raw): array
    {
        if (strlen($raw) > 1048576) {
            throw new \RuntimeException('Catalog is too large.');
        }

        $previous = libxml_use_internal_errors(true);
        $xml = simplexml_load_string($raw, 'SimpleXMLElement', LIBXML_NONET | LIBXML_NOCDATA);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        if ($xml === false) {
            throw new \RuntimeException('Catalog XML is invalid.');
        }

        $agreements = [];

        foreach ($xml->agreements->agreement ?? [] as $node) {
            $id = trim((string) ($node['id'] ?? ''));
            $url = $this->httpsUrl((string) $node->url);
            $name = $this->plain((string) $node->name, 160);

            if (!preg_match('/^[a-z0-9][a-z0-9_-]{0,40}$/', $id) || $url === '' || $name === '') {
                continue;
            }

            $agreements[] = (object) [
                'id' => $id,
                'name' => $name,
                'url' => $url,
            ];
        }

        $nodes = $xml->applications->application ?? [];
        $apps = [];

        foreach ($nodes as $node) {
            $id = trim((string) ($node['id'] ?? ''));

            if (!preg_match('/^[a-z0-9][a-z0-9_-]{0,40}$/', $id)) {
                continue;
            }

            $download = $this->httpsUrl((string) $node->download);
            $icon = $this->httpsUrl((string) $node->icon);
            $name = $this->plain((string) $node->name, 160);

            if ($download === '' || $icon === '' || $name === '') {
                continue;
            }

            $apps[] = (object) [
                'id' => $id,
                'name' => $name,
                'version' => $this->plain((string) $node->version, 32),
                'description' => $this->plain((string) $node->description, 500),
                'icon' => $icon,
                'download' => $download,
            ];
        }

        if ($apps === []) {
            throw new \RuntimeException('Catalog has no applications.');
        }

        return [
            'apps' => $apps,
            'agreements' => $agreements,
        ];
    }

    private function httpsUrl(string $url): string
    {
        $url = trim($url);

        if (!preg_match('#^https://#i', $url) || preg_match('/[\s<>"\']/', $url)) {
            return '';
        }

        return $url;
    }

    private function plain(string $value, int $limit): string
    {
        $value = trim(html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8'));

        if (function_exists('mb_substr')) {
            return mb_substr($value, 0, $limit);
        }

        return substr($value, 0, $limit);
    }

    private function cacheFile(string $url): string
    {
        $dir = JPATH_CACHE . '/mod_appcatalog';

        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
            return '';
        }

        return $dir . '/' . hash('sha256', $url) . '.xml';
    }
}
