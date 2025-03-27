import type { LogOptions } from 'logging';

export interface Settings {
    token: string;
    server_url: string;
    project_name: string;
    custom_search_query: string;
    use_custom_statuses: boolean;
    custom_statuses_mapping: string;
    loggingOptions: LogOptions;
}

const defaultSettings: Settings = {
    token: '',
    server_url: '',
    project_name: '',
    custom_search_query: '',
    use_custom_statuses: false,
    custom_statuses_mapping: '{"Epic": "*", "Task": " ", "Bug": "d", "Feature": "I", "User Story": "n"}',

    /*
    `loggingOptions` is a property in the `Settings` interface that defines the logging options for
    the application. It is an object that contains a `minLevels` property, which is a map of logger
    names to their minimum logging levels. This allows the application to control the amount of
    logging output based on the logger name and the minimum logging level. For example, the logger
    name `tasks` might have a minimum logging level of `debug`, while the root logger might have a
    minimum logging level of `info`.
    */
    loggingOptions: {
        minLevels: {
            '': 'info',
        },
    },
};

let settings: Settings = { ...defaultSettings };

function addNewOptionsToUserSettings<KeysAndValues>(defaultValues: KeysAndValues, userValues: KeysAndValues) {
    for (const flag in defaultValues) {
        if (userValues[flag] === undefined) {
            userValues[flag] = defaultValues[flag];
        }
    }
}

/**
 * Returns the current settings as a object, it will also check and
 * update the flags to make sure they are all shown in the data.json
 * file. Exposure via the settings UI is optional.
 *
 * @returns true if the feature is enabled.
 */
export const getSettings = (): Settings => {
    // Check to see if there are any new options that need to be added to the user's settings.
    addNewOptionsToUserSettings(defaultSettings.loggingOptions.minLevels, settings.loggingOptions.minLevels);

    return { ...settings };
};

export const updateSettings = (newSettings: Partial<Settings>): Settings => {
    settings = { ...settings, ...newSettings };

    return getSettings();
};

export const resetSettings = (): Settings => {
    return updateSettings(defaultSettings);
};
