import { Show } from "solid-js";

interface ConfirmDialogProps {
    message: string;
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmDialog(props: ConfirmDialogProps) {
    return (
        <Show when={props.open}>
            <div class="dialog-overlay" onClick={props.onCancel}>
                <div class="dialog-box" onClick={(e) => e.stopPropagation()}>
                    <p class="dialog-message">{props.message}</p>
                    <div class="dialog-actions">
                        <button class="dialog-btn dialog-cancel" onClick={props.onCancel}>
                            Cancel
                        </button>
                        <button class="dialog-btn dialog-confirm" onClick={props.onConfirm}>
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </Show>
    );
}
