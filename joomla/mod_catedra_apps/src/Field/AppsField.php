<?php

/**
 * @package     Catedra.Module
 * @copyright   (C) 2026 Ермаков Алексей Сергеевич
 * @license     GNU General Public License version 2 or later; see LICENSE.txt
 */

namespace Ermakov\Module\CatedraApps\Site\Field;

\defined('_JEXEC') or die;

use Ermakov\Module\CatedraApps\Site\Helper\AppsHelper;
use Joomla\CMS\Factory;
use Joomla\CMS\Form\Field\ListField;
use Joomla\CMS\Language\Text;

/**
 * Список приложений из каталога: какие показывать на сайте.
 */
class AppsField extends ListField
{
    protected $type = 'Apps';

    protected function getOptions(): array
    {
        $options = parent::getOptions();
        Factory::getLanguage()->load('mod_catedra_apps', JPATH_SITE . '/modules/mod_catedra_apps');
        Factory::getLanguage()->load('mod_catedra_apps', JPATH_ADMINISTRATOR);
        Factory::getLanguage()->load('mod_catedra_apps', JPATH_SITE);

        $url = '';

        if ($this->form) {
            $url = (string) $this->form->getValue('catalog_url', 'params', '');
        }

        if ($url === '') {
            $url = AppsHelper::DEFAULT_URL;
        }

        try {
            $apps = (new AppsHelper())->load($url, 360);
        } catch (\Throwable $error) {
            $options[] = (object) [
                'value' => '',
                'text' => Text::_('MOD_CATEDRA_APPS_FIELD_APPS_EMPTY'),
                'disable' => true,
            ];

            return $options;
        }

        foreach ($apps as $app) {
            $label = $app->name;

            if ($app->version !== '') {
                $label .= ' — ' . $app->version;
            }

            $options[] = (object) [
                'value' => $app->id,
                'text' => $label,
            ];
        }

        return $options;
    }
}
