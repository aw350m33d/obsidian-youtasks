import { Notice, Plugin } from 'obsidian';
import { Youtrack } from 'youtrack-rest-client';
import { log, logging } from 'logging';
import { YouTasksSettingTab } from 'YouTasksSettingsTab';
import { newLivePreviewExtension } from './Obsidian/LivePreviewExtension';
import { i18n, initializeI18n } from './i18n/i18n';
import { getSettings, updateSettings } from './Settings';
import { Commands } from './Commands';

export class YouTasksPlugin extends Plugin {
    youtrack: Youtrack | undefined;

    async onload() {
        await initializeI18n();
        await logging.registerConsoleLogger();
        log('info', i18n.t('main.loadingPlugin', { name: this.manifest.name, version: this.manifest.version }));
        await this.loadSettings();

        const { loggingOptions } = getSettings();
        logging.configure(loggingOptions);

        try {
            const server = getSettings().server_url;
            const apiKey = getSettings().token;

            if (!server) {
                throw new Error(
                    i18n.t('main.errors.have_no_server_url') + ' ' + i18n.t('main.errors.configure_in_settings'),
                );
            }
            if (!apiKey) {
                throw new Error(
                    i18n.t('main.errors.have_no_token') + ' ' + i18n.t('main.errors.configure_in_settings'),
                );
            }

            const config = {
                baseUrl: server,
                token: apiKey,
            };

            this.youtrack = new Youtrack(config);
            const currentUser = await this.youtrack.users.current();
            const username = currentUser.login;

            const statusBarItemEl = this.addStatusBarItem();
            statusBarItemEl.setText(i18n.t('main.logged_as_user', { username: username }));
        } catch (error) {
            new Notice(i18n.t('main.onload_exception', { error: error }));
            this.youtrack = undefined;
        }

        this.addSettingTab(new YouTasksSettingTab(this.app, this));

        if (this.youtrack) {
            this.registerEditorExtension(newLivePreviewExtension(this.youtrack));
        }
        new Commands({ plugin: this });
    }

    onunload() {}

    async loadSettings() {
        const newSettings = await this.loadData();
        updateSettings(newSettings);
    }

    async saveSettings() {
        await this.saveData(getSettings());
    }
}
