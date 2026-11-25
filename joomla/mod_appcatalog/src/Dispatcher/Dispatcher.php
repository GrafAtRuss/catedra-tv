<?php

/**
 * @package     AppCatalog.Module
 * @copyright   (C) 2026 Ермаков Алексей Сергеевич
 * @license     GNU General Public License version 2 or later; see LICENSE.txt
 */

namespace Ermakov\Module\AppCatalog\Site\Dispatcher;

\defined('_JEXEC') or die;

use Ermakov\Module\AppCatalog\Site\Helper\AppsHelper;
use Joomla\CMS\Dispatcher\DispatcherInterface;
use Joomla\CMS\Helper\HelperFactoryAwareInterface;
use Joomla\CMS\Helper\HelperFactoryAwareTrait;
use Joomla\CMS\Helper\ModuleHelper;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Uri\Uri;
use Joomla\Input\Input;
use Joomla\Registry\Registry;

class Dispatcher implements DispatcherInterface, HelperFactoryAwareInterface
{
    use HelperFactoryAwareTrait;

    protected $module;

    protected $app;

    public function __construct(\stdClass $module, $app, Input $input)
    {
        $this->module = $module;
        $this->app = $app;
    }

    public function dispatch(): void
    {
        $language = $this->app->getLanguage();
        $language->load('mod_appcatalog', JPATH_SITE . '/modules/mod_appcatalog');

        $params = new Registry($this->module->params);
        $url = trim((string) $params->get('catalog_url', AppsHelper::DEFAULT_URL));
        $refresh = (int) $params->get('refresh', 60);
        $showVersion = (int) $params->get('show_version', 1) === 1;
        $columns = (int) $params->get('columns', 3);
        $columns = max(1, min(8, $columns));
        $moduleclass = htmlspecialchars((string) $params->get('moduleclass_sfx', ''), ENT_QUOTES, 'UTF-8');
        $error = '';
        $apps = [];
        $agreements = [];

        try {
            $helper = $this->getHelperFactory()->getHelper('AppsHelper');
            $catalog = $helper->load($url, $refresh);
            $apps = $this->select($catalog['apps'], $params);
            $agreements = $catalog['agreements'];
        } catch (\Throwable $exception) {
            $error = Text::_('MOD_APPCATALOG_ERROR');
        }

        $apps = array_merge($apps, $this->extras($params));
        $note = trim((string) $params->get('policies_note', ''));

        $wa = $this->app->getDocument()->getWebAssetManager();
        $wa->registerStyle(
            'mod_appcatalog.style',
            'media/mod_appcatalog/css/style.css',
            ['version' => 'auto']
        );
        $wa->useStyle('mod_appcatalog.style');
        $wa->registerScript(
            'mod_appcatalog.qrcode',
            'media/mod_appcatalog/js/qrcode.js',
            ['version' => 'auto'],
            ['defer' => true]
        );
        $wa->registerScript(
            'mod_appcatalog',
            'media/mod_appcatalog/js/init.js',
            ['version' => 'auto'],
            ['defer' => true],
            ['mod_appcatalog.qrcode']
        );
        $wa->useScript('mod_appcatalog');

        require ModuleHelper::getLayoutPath('mod_appcatalog');
    }

    /**
     * @param list<object> $apps
     * @return list<object>
     */
    private function select(array $apps, Registry $params): array
    {
        $mode = (string) $params->get('mode', 'all');

        if ($mode !== 'only') {
            return $apps;
        }

        $picked = $params->get('apps', []);

        if (is_object($picked)) {
            $picked = (array) $picked;
        }

        if (is_string($picked)) {
            $picked = preg_split('/\s*,\s*/', $picked, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        }

        if (!is_array($picked)) {
            $picked = [];
        }

        $picked = array_values(array_filter(array_map('strval', $picked)));

        if ($mode !== 'only' || $picked === []) {
            return $apps;
        }

        $allow = array_flip($picked);

        return array_values(array_filter(
            $apps,
            static function ($app) use ($allow) {
                return isset($allow[$app->id]);
            }
        ));
    }

    /**
     * @return list<object>
     */
    private function extras(Registry $params): array
    {
        $raw = $params->get('extras', []);

        if (is_object($raw)) {
            $raw = (array) $raw;
        }

        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            $raw = is_array($decoded) ? $decoded : [];
        }

        if (!is_array($raw)) {
            return [];
        }

        $items = [];

        foreach ($raw as $row) {
            if (is_object($row)) {
                $row = (array) $row;
            }

            if (!is_array($row)) {
                continue;
            }

            $name = trim((string) ($row['name'] ?? ''));
            $download = $this->httpUrl((string) ($row['download'] ?? ''));

            if ($name === '' || $download === '') {
                continue;
            }

            $item = new \stdClass();
            $item->id = 'extra';
            $item->name = $name;
            $item->version = trim((string) ($row['version'] ?? ''));
            $item->icon = $this->httpUrl((string) ($row['icon'] ?? ''), true);
            $item->download = $download;
            $item->description = trim((string) ($row['description'] ?? ''));
            $items[] = $item;
        }

        return $items;
    }

    private function httpUrl(string $value, bool $allowRelative = false): string
    {
        $value = trim($value);

        if ($value === '' || preg_match('#^(?:javascript|data|vbscript):#i', $value)) {
            return '';
        }

        if (preg_match('#^https?://#i', $value)) {
            return $value;
        }

        if ($allowRelative && !preg_match('#^[a-z][a-z0-9+.-]*:#i', $value)) {
            return rtrim(Uri::root(), '/') . '/' . ltrim($value, '/');
        }

        return '';
    }
}
