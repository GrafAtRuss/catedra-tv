<?php

/**
 * @package     AppCatalog.Module
 * @copyright   (C) 2026 Ермаков Алексей Сергеевич
 * @license     GNU General Public License version 2 or later; see LICENSE.txt
 */

\defined('_JEXEC') or die;

use Joomla\CMS\Language\Text;

/** @var array $apps */
/** @var array $agreements */
/** @var string $error */
/** @var bool $showVersion */
/** @var string $moduleclass */
?>
<div class="appcatalog<?php echo $moduleclass; ?>" data-appcatalog-close="<?php echo htmlspecialchars(Text::_('MOD_APPCATALOG_CLOSE'), ENT_QUOTES, 'UTF-8'); ?>">
    <?php if ($error !== '') : ?>
        <p class="appcatalog__error"><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></p>
    <?php endif; ?>
    <?php foreach ($apps as $app) : ?>
        <?php
        $download = htmlspecialchars($app->download, ENT_QUOTES, 'UTF-8');
        $name = htmlspecialchars($app->name, ENT_QUOTES, 'UTF-8');
        ?>
        <article class="appcatalog-app">
            <h3 class="appcatalog-app__name">
                <a href="<?php echo $download; ?>" target="_blank" rel="noopener noreferrer"><?php echo $name; ?></a>
            </h3>
            <?php if ($showVersion && $app->version !== '') : ?>
                <p class="appcatalog-app__version">
                    <?php echo htmlspecialchars(Text::sprintf('MOD_APPCATALOG_VERSION', $app->version), ENT_QUOTES, 'UTF-8'); ?>
                </p>
            <?php endif; ?>
            <div class="appcatalog-app__row">
                <img
                    class="appcatalog-app__icon"
                    src="<?php echo htmlspecialchars($app->icon, ENT_QUOTES, 'UTF-8'); ?>"
                    alt=""
                    width="96"
                    height="96"
                    loading="lazy"
                >
                <a
                    class="appcatalog-app__qr"
                    href="<?php echo $download; ?>"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-qr="<?php echo $download; ?>"
                    aria-label="<?php echo htmlspecialchars(Text::sprintf('MOD_APPCATALOG_QR', $app->name), ENT_QUOTES, 'UTF-8'); ?>"
                >
                    <span class="appcatalog-app__qr-fallback"><?php echo htmlspecialchars(Text::_('MOD_APPCATALOG_DOWNLOAD'), ENT_QUOTES, 'UTF-8'); ?></span>
                </a>
            </div>
            <?php if ($app->description !== '') : ?>
                <p class="appcatalog-app__desc"><?php echo htmlspecialchars($app->description, ENT_QUOTES, 'UTF-8'); ?></p>
            <?php endif; ?>
        </article>
    <?php endforeach; ?>
    <?php if ($agreements !== []) : ?>
        <nav class="appcatalog__policies" aria-label="<?php echo htmlspecialchars(Text::_('MOD_APPCATALOG_POLICIES'), ENT_QUOTES, 'UTF-8'); ?>">
            <?php foreach ($agreements as $doc) : ?>
                <a
                    href="<?php echo htmlspecialchars($doc->url, ENT_QUOTES, 'UTF-8'); ?>"
                    data-appcatalog-policy="<?php echo htmlspecialchars($doc->id, ENT_QUOTES, 'UTF-8'); ?>"
                    data-title="<?php echo htmlspecialchars($doc->name, ENT_QUOTES, 'UTF-8'); ?>"
                ><?php echo htmlspecialchars($doc->name, ENT_QUOTES, 'UTF-8'); ?></a>
            <?php endforeach; ?>
        </nav>
    <?php endif; ?>
</div>
