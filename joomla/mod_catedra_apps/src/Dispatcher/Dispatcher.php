<?php

/**
 * @package     Catedra.Module
 * @copyright   (C) 2026 Ермаков Алексей Сергеевич
 * @license     GNU General Public License version 2 or later; see LICENSE.txt
 */

namespace Ermakov\Module\CatedraApps\Site\Dispatcher;

\defined('_JEXEC') or die;

use Ermakov\Module\CatedraApps\Site\Helper\AppsHelper;
use Joomla\CMS\Dispatcher\DispatcherInterface;
use Joomla\CMS\Helper\HelperFactoryAwareInterface;
use Joomla\CMS\Helper\HelperFactoryAwareTrait;
use Joomla\CMS\Helper\ModuleHelper;
use Joomla\CMS\Language\Text;
use Joomla\Input\Input;
use Joomla\Registry\Registry;

class Dispatcher implements DispatcherInterface, HelperFactoryAwareInterface
{
    use HelperFactoryAwareTrait;

    private const DEFAULTS = ['phone', 'tv', 'yaos', 'tizen', 'aurora32', 'aurora64'];

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
        $language->load('mod_catedra_apps', JPATH_SITE . '/modules/mod_catedra_apps');

        $params = new Registry($this->module->params);
        $url = trim((string) $params->get('catalog_url', AppsHelper::DEFAULT_URL));
        $refresh = (int) $params->get('refresh', 60);
        $showVersion = (int) $params->get('show_version', 1) === 1;
        $moduleclass = htmlspecialchars((string) $params->get('moduleclass_sfx', ''), ENT_QUOTES, 'UTF-8');
        $error = '';
        $apps = [];

        try {
            $helper = $this->getHelperFactory()->getHelper('AppsHelper');
            $apps = $helper->load($url, $refresh);
            $apps = $this->select($apps, $params);
        } catch (\Throwable $exception) {
            $error = Text::_('MOD_CATEDRA_APPS_ERROR');
        }

        $wa = $this->app->getDocument()->getWebAssetManager();
        $wa->registerStyle(
            'mod_catedra_apps.style',
            'media/mod_catedra_apps/css/style.css',
            ['version' => 'auto']
        );
        $wa->useStyle('mod_catedra_apps.style');
        $wa->registerScript(
            'mod_catedra_apps.qrcode',
            'media/mod_catedra_apps/js/qrcode.js',
            ['version' => 'auto'],
            ['defer' => true]
        );
        $wa->registerScript(
            'mod_catedra_apps',
            'media/mod_catedra_apps/js/init.js',
            ['version' => 'auto'],
            ['defer' => true],
            ['mod_catedra_apps.qrcode']
        );
        $wa->useScript('mod_catedra_apps');

        require ModuleHelper::getLayoutPath('mod_catedra_apps');
    }

    /**
     * @param list<object> $apps
     * @return list<object>
     */
    private function select(array $apps, Registry $params): array
    {
        $mode = (string) $params->get('mode', 'only');

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

        if ($picked === []) {
            $picked = self::DEFAULTS;
        }

        $allow = array_flip($picked);

        return array_values(array_filter(
            $apps,
            static function ($app) use ($allow) {
                return isset($allow[$app->id]);
            }
        ));
    }
}
