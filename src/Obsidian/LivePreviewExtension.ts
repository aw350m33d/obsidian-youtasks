import { EditorView } from '@codemirror/view';
import { PluginValue } from '@codemirror/view';
import { ViewPlugin } from '@codemirror/view';
import { Notice } from 'obsidian';
import { Youtrack } from 'youtrack-rest-client';

export const newLivePreviewExtension = (youtrack: Youtrack) => {
    return ViewPlugin.fromClass(
        class extends LivePreviewExtension {
            constructor(view: EditorView) {
                super(view, youtrack);
            }
        },
    );
};

/**
 * Integrate custom handling of checkbox clicks in the Obsidian editor's Live Preview mode.
 *
 * This class is primarily designed for checkbox-driven task management in the Obsidian plugin, overriding the default handling behavior.
 * It listens for click events, detects checkbox interactions, and updates the document state accordingly.
 *
 * Bug reports associated with this code: (label:"display: live preview")
 * https://github.com/obsidian-tasks-group/obsidian-tasks/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22display%3A%20live%20preview%22%20label%3A%22type%3A%20bug%22
 *
 * See also {@link InlineRenderer} which handles Markdown task lines in Obsidian's Reading mode.
 */
class LivePreviewExtension implements PluginValue {
    private readonly view: EditorView;
    private readonly youtrack: Youtrack;

    constructor(view: EditorView, youtrack: Youtrack) {
        this.view = view;
        this.youtrack = youtrack;

        this.handleClickEvent = this.handleClickEvent.bind(this);
        this.view.dom.addEventListener('click', this.handleClickEvent);
    }

    public destroy(): void {
        this.view.dom.removeEventListener('click', this.handleClickEvent);
    }

    private async handleClickEvent(event: MouseEvent): Promise<boolean> {
        const { target } = event;

        // Only handle checkbox clicks.
        if (!target || !(target instanceof HTMLInputElement) || target.type !== 'checkbox') {
            return false;
        }

        const { state } = this.view;
        const position = this.view.posAtDOM(target);
        const line = state.doc.lineAt(position);

        console.debug(`Live Preview Extension: toggle called. Position: ${position} Line: ${line.text}`);

        const matches = line.text.match('🆔 ([A-Z]{3}-[\\d]+)');
        if (matches != null && matches.length == 2) {
            const issue_id = matches[1];
            const issues = await this.youtrack.issues.search(`project: OCI ${issue_id}`);
            if (issues.length == 1 && issues[0].id) {
                const state = line.text.match('- \\[ \\]') ? 'Backlog' : 'Done';
                await this.youtrack.issues.executeCommand({
                    query: `State: ${state}`,
                    issues: [
                        {
                            id: issues[0].id,
                        },
                    ],
                });
                new Notice(`State of YouTrack issue ${issue_id} has been changed to ${state}`);
            }
        }
        return true;
    }
}
