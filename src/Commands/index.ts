import type { App, Editor, EditorPosition, MarkdownFileInfo } from 'obsidian';
import { MarkdownView, Notice } from 'obsidian';
import { IssueCustomField } from 'youtrack-rest-client/dist/entities/issueCustomField';
import moment from 'moment';
import { Settings, getSettings } from 'Settings';
import type YouTasksPlugin from 'main';
import { i18n } from 'i18n/i18n';

/**
 * Retrieves a custom string field from the issue fields by name.
 * @param fields - The array of issue custom fields.
 * @param name - The name of the custom field to retrieve.
 * @returns The value of the custom field if found, otherwise undefined.
 */
function getCustomStringFieldByName(fields: IssueCustomField[] | undefined, name: string): string | undefined {
    const field = fields?.find((field) => field.name === name);
    if (field) {
        switch (field.$type) {
            case 'SingleEnumIssueCustomField':
                return field.value?.name;
            case 'PeriodIssueCustomField':
                return field.value?.presentation;
            case 'SingleOwnedIssueCustomField':
                return field.value?.name;
            default:
                return undefined;
        }
    }
    return undefined;
}

/**
 * Retrieves a custom number field from the issue fields by name.
 * @param fields - The array of issue custom fields.
 * @param name - The name of the custom field to retrieve.
 * @returns The value of the custom field if found, otherwise undefined.
 */
function getCustomNumberFieldByName(fields: IssueCustomField[], name: string): number | undefined {
    const field = fields?.find((field) => field.name === name);
    if (field && field.$type === 'DateIssueCustomField') {
        return field.value;
    }
    return undefined;
}

/**
 * Formats a timestamp into a date string.
 * @param timestamp - The timestamp to format.
 * @returns The formatted date string.
 */
function getDateFromTS(timestamp: number | undefined): string {
    return moment(timestamp).format('YYYY-MM-DD');
}

/**
 * Class to handle commands related to YouTrack issues.
 */
export class Commands {
    private readonly plugin: YouTasksPlugin;

    /**
     * Gets the Obsidian app instance.
     */
    private get app(): App {
        return this.plugin.app;
    }

    /**
     * Constructs the Commands class.
     * @param plugin - The YouTasks plugin instance.
     */
    constructor({ plugin }: { plugin: YouTasksPlugin }) {
        this.plugin = plugin;
        this.registerAddYouTrackIssuesCommand();
    }

    /**
     * Registers the command to add YouTrack issues to the editor.
     */
    private registerAddYouTrackIssuesCommand(): void {
        this.plugin.addCommand({
            id: 'add-yt-issues',
            name: i18n.t('commands.add_issues_command'),
            icon: 'settings',
            editorCheckCallback: async (checking: boolean, editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
                if (checking) {
                    return view instanceof MarkdownView;
                }

                if (!(view instanceof MarkdownView)) {
                    return;
                }

                const path = view.file?.path;
                if (!path) {
                    return;
                }

                const origCursorPos = editor.getCursor();
                const lineNumber = origCursorPos.line;

                const settings = getSettings();

                if (!settings.project_name) {
                    new Notice(
                        i18n.t('commands.errors.uninitialized_youtrack_project') +
                            '\n' +
                            i18n.t('main.errors.configure_in_settings'),
                    );
                    return;
                }

                // default query
                let query = `project: ${settings.project_name} sort by: updated Assignee: me State: -Done -Canceled`;

                if (settings.custom_search_query) {
                    query = settings.custom_search_query;
                }

                // if custom query doesn't contain project from settings we can't guess issues' IDs
                if (!query.match(`project:\\s*${settings.project_name}`)) {
                    new Notice(
                        i18n.t('commands.errors.invalid_project_in_query') +
                            '\n' +
                            i18n.t('main.errors.configure_in_settings'),
                    );
                    return;
                }

                await this.handleYouTrackIssues(query, settings, editor, lineNumber, origCursorPos);
            },
        });
    }

    private async handleYouTrackIssues(
        query: string,
        settings: Settings,
        editor: Editor,
        lineNumber: number,
        origCursorPos: EditorPosition,
    ) {
        try {
            if (!this.plugin.youtrack) {
                new Notice(i18n.t('commands.errors.uninitialized_youtrack_client'));
                return;
            }
            const issues = await this.plugin.youtrack.issues.search(query);
            if (issues) {
                const formattedIssues = await this.formatIssues(issues, settings);
                const text = formattedIssues.join('\n');
                editor.setLine(lineNumber, text);
                editor.setCursor(getNewCursorPosition(origCursorPos, { text, moveTo: { ch: text.length } }));
            } else {
                new Notice(i18n.t('commands.errors.query_return_zero_issues', { query: query }));
            }
        } catch (error) {
            new Notice(i18n.t('commands.errors.retrieve_issues_exception', { error: error }));
        }
    }

    /**
     * Formats the retrieved issues into a list of task lines.
     * @param issues - The array of issues to format.
     * @param settings - The plugin settings.
     * @returns An array of formatted task lines.
     */
    private async formatIssues(issues: any[], settings: ReturnType<typeof getSettings>): Promise<string[]> {
        const formattedIssues: string[] = [];
        let filtered_count = 0;
        for (const issue of issues) {
            // @ts-ignore-error
            const tasks = this.plugin.app.plugins.plugins['obsidian-tasks-plugin'].getTasks().map((t) => t.id);
            if (tasks.includes(`${settings.project_name}-${issue.numberInProject}`)) {
                filtered_count += 1;
                continue;
            }

            let tags_line = '';
            if (issue.id) {
                const extendedIssue = await this.plugin.youtrack?.issues.byId(issue.id);
                if (extendedIssue?.tags) {
                    const tags = extendedIssue?.tags.map((tag) => `#${tag.name}`);
                    tags_line = tags.join(' ');
                }
                let issueType = ' ';
                if (settings.use_custom_statuses) {
                    const typeSymbols = settings.custom_statuses_mapping
                        ? JSON.parse(settings.custom_statuses_mapping)
                        : {
                              Epic: '*',
                              Task: ' ',
                              Bug: 'd',
                              Feature: 'I',
                              'User Story': 'n',
                          };

                    if (extendedIssue && extendedIssue.fields) {
                        const rawIssueType = getCustomStringFieldByName(extendedIssue.fields, 'Type');
                        if (rawIssueType && rawIssueType in typeSymbols) {
                            issueType = typeSymbols[rawIssueType];
                        }
                    }
                }

                let taskLine = `- [${issueType}] ${issue.summary} [Открыть](${settings.server_url}/issue/${settings.project_name}-${issue.numberInProject}) ${tags_line}`;

                if (extendedIssue && extendedIssue.fields) {
                    const rawEstimation = getCustomStringFieldByName(extendedIssue.fields, 'Estimation');
                    if (rawEstimation) {
                        taskLine += ' ⏰ ' + rawEstimation;
                    }

                    const prioritySymbols = {
                        Critical: '🔺',
                        High: '⏫',
                        Normal: '🔼',
                        Low: '🔽',
                        Minimal: '⏬',
                        Undefined: '',
                    };

                    const rawPriority = getCustomStringFieldByName(extendedIssue.fields, 'Priority');
                    if (rawPriority && typeof rawPriority === 'string' && rawPriority in prioritySymbols) {
                        // @ts-ignore-error
                        taskLine += ' ' + prioritySymbols[rawPriority];
                    }

                    taskLine += ' ➕ ' + getDateFromTS(extendedIssue.created);

                    const rawDeadline = getCustomNumberFieldByName(extendedIssue.fields, 'Deadline date');
                    if (rawDeadline && typeof rawDeadline === 'number') {
                        taskLine += ' 📅 ' + getDateFromTS(rawDeadline);
                    }
                }

                taskLine += ` 🆔 ${settings.project_name}-${issue.numberInProject}`;
                formattedIssues.push(taskLine);
            } else {
                formattedIssues.push(
                    `- [ ] [${settings.project_name}-${issue.numberInProject}](${settings.server_url}/issue/${settings.server_url}-${issue.numberInProject}) ${issue.summary} #youtrack`,
                );
            }
        }
        new Notice(i18n.t('commands.fetched_issues_count', { count: issues.length }));
        new Notice(i18n.t('commands.filtered_issues_count', { count: filtered_count }));
        return formattedIssues;
    }
}

/**
 * Computes the new absolute position of the cursor so that it is positioned within the inserted text as specified
 * by {@link insertion}.moveTo.
 *
 * @param startPos - The starting cursor position.
 * @param insertion - The inserted text and suggested cursor position within that text.
 * @returns The new cursor position.
 */
export const getNewCursorPosition = (
    startPos: EditorPosition,
    insertion: { text: string; moveTo?: Partial<EditorPosition> },
): EditorPosition => {
    const defaultMoveTo = { line: 0, ch: startPos.ch };
    const moveTo = { ...defaultMoveTo, ...(insertion.moveTo ?? {}) };
    const destinationLineLength = insertion.text.split('\n')[moveTo.line].length;

    return {
        line: startPos.line + moveTo.line,
        ch: Math.min(moveTo.ch, destinationLineLength),
    };
};
