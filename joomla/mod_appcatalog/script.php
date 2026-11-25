<?php

/**
 * @package     AppCatalog.Module
 * @copyright   (C) 2026 Ермаков Алексей Сергеевич
 * @license     GNU General Public License version 2 or later; see LICENSE.txt
 */

\defined('_JEXEC') or die;

/**
 * Языковые файлы нужны и на сайте, и в менеджере модулей.
 */
class mod_appcatalogInstallerScript
{
    public function install($parent): bool
    {
        $this->copyLanguages($parent);

        return true;
    }

    public function update($parent): bool
    {
        $this->copyLanguages($parent);

        return true;
    }

    private function copyLanguages($parent): void
    {
        try {
            $source = $parent->getParent()->getPath('source') . '/language';
        } catch (\Throwable $error) {
            return;
        }

        if (!is_dir($source)) {
            return;
        }

        $targets = [JPATH_SITE, JPATH_ADMINISTRATOR];

        foreach ($targets as $base) {
            foreach (['ru-RU', 'en-GB'] as $tag) {
                $from = $source . '/' . $tag;

                if (!is_dir($from)) {
                    continue;
                }

                $to = $base . '/language/' . $tag;

                if (!is_dir($to) && !@mkdir($to, 0755, true) && !is_dir($to)) {
                    continue;
                }

                foreach (glob($from . '/*.ini') ?: [] as $file) {
                    @copy($file, $to . '/' . basename($file));
                }
            }
        }
    }
}
