<?php

/**
 * @package     Catedra.Module
 * @copyright   (C) 2026 Ермаков Алексей Сергеевич
 * @license     GNU General Public License version 2 or later; see LICENSE.txt
 */

\defined('_JEXEC') or die;

use Joomla\CMS\Language\Text;

/** @var array $apps */
/** @var string $error */
/** @var bool $showVersion */
/** @var string $moduleclass */
?>
<div class="catedra-apps<?php echo $moduleclass; ?>">
    <?php if ($error !== '') : ?>
        <p class="catedra-apps__error"><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></p>
    <?php endif; ?>
    <?php foreach ($apps as $app) : ?>
        <?php
        $download = htmlspecialchars($app->download, ENT_QUOTES, 'UTF-8');
        $name = htmlspecialchars($app->name, ENT_QUOTES, 'UTF-8');
        ?>
        <article class="catedra-app">
            <h3 class="catedra-app__name">
                <a href="<?php echo $download; ?>"><?php echo $name; ?></a>
            </h3>
            <?php if ($showVersion && $app->version !== '') : ?>
                <p class="catedra-app__version">
                    <?php echo htmlspecialchars(Text::sprintf('MOD_CATEDRA_APPS_VERSION', $app->version), ENT_QUOTES, 'UTF-8'); ?>
                </p>
            <?php endif; ?>
            <div class="catedra-app__row">
                <img
                    class="catedra-app__icon"
                    src="<?php echo htmlspecialchars($app->icon, ENT_QUOTES, 'UTF-8'); ?>"
                    alt=""
                    width="96"
                    height="96"
                    loading="lazy"
                >
                <a
                    class="catedra-app__qr"
                    href="<?php echo $download; ?>"
                    data-qr="<?php echo $download; ?>"
                    aria-label="<?php echo htmlspecialchars(Text::sprintf('MOD_CATEDRA_APPS_QR', $app->name), ENT_QUOTES, 'UTF-8'); ?>"
                >
                    <span class="catedra-app__qr-fallback"><?php echo htmlspecialchars(Text::_('MOD_CATEDRA_APPS_DOWNLOAD'), ENT_QUOTES, 'UTF-8'); ?></span>
                </a>
            </div>
            <?php if ($app->description !== '') : ?>
                <p class="catedra-app__desc"><?php echo htmlspecialchars($app->description, ENT_QUOTES, 'UTF-8'); ?></p>
            <?php endif; ?>
        </article>
    <?php endforeach; ?>
</div>
