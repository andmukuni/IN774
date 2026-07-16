import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import ConfirmDialog from '../ui/ConfirmDialog';

export default function RecordShowActions({
  backTo,
  backLabel = 'Back',
  editTo,
  editLabel = 'Edit',
  onDelete,
  deleteTitle = 'Delete record',
  deleteMessage = 'Are you sure you want to delete this record? This action cannot be undone.',
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      setConfirmOpen(false);
    } catch {
      // Caller handles toast/errors; keep dialog open on failure.
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-navy-200 text-sm font-medium text-navy-700 hover:bg-navy-50 transition-colors"
        >
          <ArrowLeft size={16} />
          {backLabel}
        </Link>
        {editTo && (
          <Link
            to={editTo}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
          >
            <Pencil size={16} />
            {editLabel}
          </Link>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={16} />
            Delete
          </button>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => !deleting && setConfirmOpen(false)}
        onConfirm={handleDelete}
        title={deleteTitle}
        message={deleteMessage}
        confirmLabel="Delete"
        loading={deleting}
      />
    </>
  );
}
