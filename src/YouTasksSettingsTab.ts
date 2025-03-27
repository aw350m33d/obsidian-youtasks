import { App, PluginSettingTab, Setting } from 'obsidian';
import { YouTasksPlugin } from 'YouTasksPlugin';
import { i18n } from 'i18n/i18n';
import { getSettings, updateSettings } from './Settings';

export class YouTasksSettingTab extends PluginSettingTab {
    plugin: YouTasksPlugin;

    constructor(app: App, plugin: YouTasksPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    public async saveSettings(update?: boolean): Promise<void> {
        await this.plugin.saveSettings();

        if (update) {
            this.display();
        }
    }

    private static createFragmentWithHTML(html: string) {
        return createFragment((documentFragment) => (documentFragment.createDiv().innerHTML = html));
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        this.addConnectionSettings(containerEl);
        this.addQuerySettings(containerEl);
        this.addAdvancedSettings(containerEl);
    }

    private addConnectionSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName(i18n.t('settings.connection.heading')).setHeading();
        this.addLongTextSetting(
            containerEl,
            i18n.t('settings.connection.token_label'),
            i18n.t('settings.connection.token_placeholder'),
            'token',
        );
        this.addLongTextSetting(
            containerEl,
            i18n.t('settings.connection.server_url_label'),
            i18n.t('settings.connection.server_url_label'),
            'server_url',
        );
    }

    private addQuerySettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName(i18n.t('settings.issues_search_query.heading')).setHeading();
        this.addTextSetting(
            containerEl,
            i18n.t('settings.issues_search_query.project_label'),
            i18n.t('settings.issues_search_query.project_placeholder'),
            'project_name',
        );
        this.addTextAreaSetting(
            containerEl,
            i18n.t('settings.issues_search_query.custom_query_label'),
            i18n.t('settings.issues_search_query.custom_query_placeholder'),
            'custom_search_query',
        );
    }

    private addAdvancedSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName(i18n.t('settings.advanced.custom_statuses')).setHeading();

        let customStatusesMapping: Setting | null = null;

        new Setting(containerEl).setName(i18n.t('settings.advanced.custom_statuses_usage')).addToggle((toggle) => {
            const settings = getSettings();
            toggle.setValue(settings.use_custom_statuses).onChange(async (value) => {
                updateSettings({ use_custom_statuses: value });
                setSettingVisibility(customStatusesMapping, value);
                await this.plugin.saveSettings();
            });
        });

        customStatusesMapping = new Setting(containerEl)
            .setName(i18n.t('settings.advanced.custom_statuses_mapping'))
            .setDesc(YouTasksSettingTab.createFragmentWithHTML('<br>'))
            .addTextArea((text) => {
                const settings = getSettings();
                text.setPlaceholder(i18n.t('settings.advanced.custom_statuses_mapping_placeholder'))
                    .setValue(settings.custom_statuses_mapping)
                    .onChange(async (value) => {
                        updateSettings({ custom_statuses_mapping: value });
                        await this.plugin.saveSettings();
                    });
            });
        makeMultilineTextSetting(customStatusesMapping);
        setSettingVisibility(customStatusesMapping, getSettings().use_custom_statuses);
    }

    private addTextSetting(containerEl: HTMLElement, name: string, placeholder: string, settingKey: string) {
        new Setting(containerEl).setName(name).addText((text) =>
            text
                .setPlaceholder(placeholder)
                // @ts-expect-error
                .setValue(getSettings()[settingKey])
                .onChange(async (value) => {
                    const settings = getSettings();
                    // @ts-expect-error
                    settings[settingKey] = value;
                    updateSettings(settings);
                    await this.plugin.saveSettings();
                }),
        );
    }

    private addLongTextSetting(containerEl: HTMLElement, name: string, placeholder: string, settingKey: string) {
        makeLongTextSetting(
            new Setting(containerEl).setName(name).addText((text) =>
                text
                    .setPlaceholder(placeholder)
                    // @ts-expect-error
                    .setValue(getSettings()[settingKey])
                    .onChange(async (value) => {
                        const settings = getSettings();
                        // @ts-expect-error
                        settings[settingKey] = value;
                        updateSettings(settings);
                        await this.plugin.saveSettings();
                    }),
            ),
        );
    }

    private addTextAreaSetting(containerEl: HTMLElement, name: string, placeholder: string, settingKey: string) {
        makeMultilineTextSetting(
            new Setting(containerEl)
                .setName(name)
                .setDesc(YouTasksSettingTab.createFragmentWithHTML('<br>'))
                .addTextArea((text) =>
                    text
                        .setPlaceholder(placeholder)
                        // @ts-expect-error
                        .setValue(getSettings()[settingKey])
                        .onChange(async (value) => {
                            const settings = getSettings();
                            // @ts-expect-error
                            settings[settingKey] = value;
                            updateSettings(settings);
                            await this.plugin.saveSettings();
                        }),
                ),
        );
    }
}

function makeMultilineTextSetting(setting: Setting) {
    const { settingEl, infoEl, controlEl } = setting;
    const textEl: HTMLElement | null = controlEl.querySelector('textarea');

    if (textEl === null) {
        return;
    }

    settingEl.style.display = 'block';
    infoEl.style.marginRight = '0px';
    textEl.style.minWidth = '-webkit-fill-available';
    textEl.style.minHeight = '100px';
}

function makeLongTextSetting(setting: Setting) {
    const { controlEl } = setting;
    const textEl: HTMLElement | null = controlEl.querySelector('input');

    if (textEl === null) {
        return;
    }

    textEl.style.minWidth = '500px';
}

function setSettingVisibility(setting: Setting | null, visible: boolean) {
    if (setting) {
        // @ts-expect-error Setting.setVisibility() is not exposed in the API.
        setting.setVisibility(visible);
    } else {
        console.warn(i18n.t('settings.errors.setting_not_initialized'));
    }
}
