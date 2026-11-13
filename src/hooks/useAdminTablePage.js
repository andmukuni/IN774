import { useCallback, useMemo, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { downloadAdminExport } from '../utils/exportDownload';
import { getApiBase } from '../utils/apiBase';
import { getAdminAuthHeaders } from '../utils/authHeaders';

const API_BASE = getApiBase();

export function useAdminTablePage({
  canView = false,
  canManage = false,
  exportPath = '',
  exportFilename = 'export',
  buildExportParams,
  bulkDeletePath = '',
  bulkStatusPath = '',
  singleDeletePath = '',
  entityLabel = 'record',
  entityLabelPlural = 'records',
  singleDeleteSuccessMessage,
}) {
  const toast = useToast();
  const tableRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [exportingFormat, setExportingFormat] = useState('');

  const selectedCount = selectedIds.size;
  const busy = Boolean(exportingFormat || deleting || updatingStatus);

  const reloadTable = useCallback(() => {
    tableRef.current?.reload(false);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    tableRef.current?.clearSelection?.();
  }, []);

  const handleSelectionChange = useCallback((next) => {
    setSelectedIds(next instanceof Set ? new Set(next) : new Set(next || []));
  }, []);

  const handleDeleteRequest = useCallback((id, label) => {
    setDeleteTarget({ mode: 'single', id, label: label || `this ${entityLabel}` });
  }, [entityLabel]);

  const handleBulkDeleteRequest = useCallback(() => {
    if (!selectedCount || !bulkDeletePath) return;
    setDeleteTarget({ mode: 'bulk', count: selectedCount });
  }, [bulkDeletePath, selectedCount]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.mode === 'bulk') {
        const res = await fetch(`${API_BASE}${bulkDeletePath}`, {
          method: 'POST',
          headers: {
            ...getAdminAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ids: Array.from(selectedIds) }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || `Failed to delete selected ${entityLabelPlural}.`);
        }
        const deleted = json.deleted ?? selectedCount;
        const skipped = json.skipped ?? 0;
        const message = skipped > 0
          ? `${deleted} ${entityLabelPlural} deleted. ${skipped} skipped.`
          : `${deleted} ${entityLabelPlural} deleted.`;
        toast(message, { type: 'success' });
        clearSelection();
      } else if (deleteTarget.id && singleDeletePath) {
        const res = await fetch(`${API_BASE}${singleDeletePath}/${deleteTarget.id}`, {
          method: 'DELETE',
          headers: getAdminAuthHeaders(),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.message || `Failed to delete ${entityLabel}.`);
        }
        toast(singleDeleteSuccessMessage || `${entityLabel.charAt(0).toUpperCase()}${entityLabel.slice(1)} deleted.`, { type: 'success' });
      }
      setDeleteTarget(null);
      reloadTable();
    } catch (err) {
      toast(err?.message || 'Delete failed.', { type: 'error' });
    } finally {
      setDeleting(false);
    }
  }, [
    bulkDeletePath,
    clearSelection,
    deleteTarget,
    entityLabel,
    entityLabelPlural,
    reloadTable,
    selectedCount,
    selectedIds,
    singleDeletePath,
    singleDeleteSuccessMessage,
    toast,
  ]);

  const handleStatusRequest = useCallback((status, label) => {
    if (!selectedCount || !bulkStatusPath) return;
    setStatusTarget({ status, label: label || status, count: selectedCount });
  }, [bulkStatusPath, selectedCount]);

  const handleStatusConfirm = useCallback(async () => {
    if (!statusTarget?.status || !bulkStatusPath) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`${API_BASE}${bulkStatusPath}`, {
        method: 'POST',
        headers: {
          ...getAdminAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          status: statusTarget.status,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || `Failed to update ${entityLabelPlural}.`);
      }
      toast(`${json.updated || selectedCount} ${entityLabelPlural} updated.`, { type: 'success' });
      setStatusTarget(null);
      clearSelection();
      reloadTable();
    } catch (err) {
      toast(err?.message || 'Status update failed.', { type: 'error' });
    } finally {
      setUpdatingStatus(false);
    }
  }, [bulkStatusPath, clearSelection, entityLabelPlural, reloadTable, selectedCount, selectedIds, statusTarget, toast]);

  const handleExport = useCallback(async (format, appliedFilters) => {
    if (!canView || !exportPath || !buildExportParams) return;
    setExportingFormat(format);
    try {
      await downloadAdminExport({
        path: exportPath,
        params: {
          format,
          ...buildExportParams(appliedFilters, selectedIds),
        },
        fallbackFilename: `${exportFilename}.${format}`,
        errorMessage: `Failed to export ${entityLabelPlural} as ${format.toUpperCase()}.`,
      });
      toast(`Exported as ${format.toUpperCase()}.`, { type: 'success' });
    } catch (err) {
      toast(err?.message || 'Export failed.', { type: 'error' });
    } finally {
      setExportingFormat('');
    }
  }, [buildExportParams, canView, entityLabelPlural, exportFilename, exportPath, selectedIds, toast]);

  const buildTableActions = useCallback(({
    appliedFilters,
    statusActions = [],
    includeDelete = true,
    includeExport = true,
  }) => {
    const items = [];

    if (includeExport && canView && exportPath) {
      items.push(
        {
          key: 'export-csv',
          label: exportingFormat === 'csv' ? 'Exporting CSV…' : 'Export CSV',
          disabled: busy,
          onClick: () => handleExport('csv', appliedFilters),
        },
        {
          key: 'export-pdf',
          label: exportingFormat === 'pdf' ? 'Exporting PDF…' : 'Export PDF',
          disabled: busy,
          onClick: () => handleExport('pdf', appliedFilters),
        },
      );
    }

    if (canManage && (statusActions.length || (includeDelete && bulkDeletePath))) {
      items.push({ key: 'divider-manage', type: 'divider' });
      statusActions.forEach((action) => {
        items.push({
          key: action.key,
          label: action.label,
          disabled: busy || !selectedCount,
          onClick: () => handleStatusRequest(action.status, action.confirmLabel || action.label),
        });
      });
      if (includeDelete && bulkDeletePath) {
        items.push({
          key: 'delete',
          label: 'Delete selected',
          tone: 'danger',
          disabled: busy || !selectedCount,
          onClick: handleBulkDeleteRequest,
        });
      }
    }

    return items;
  }, [
    bulkDeletePath,
    busy,
    canManage,
    canView,
    exportPath,
    exportingFormat,
    handleBulkDeleteRequest,
    handleExport,
    handleStatusRequest,
    selectedCount,
  ]);

  const selectable = useMemo(() => {
    if (!canView && !canManage) return null;
    return {
      idKey: 'id',
      selectedIds,
      onSelectionChange: handleSelectionChange,
      disabled: busy,
    };
  }, [busy, canManage, canView, handleSelectionChange, selectedIds]);

  return {
    tableRef,
    selectedIds,
    selectedCount,
    clearSelection,
    handleSelectionChange,
    deleting,
    updatingStatus,
    exportingFormat,
    busy,
    deleteTarget,
    statusTarget,
    setDeleteTarget,
    setStatusTarget,
    handleDeleteRequest,
    handleDeleteConfirm,
    handleStatusConfirm,
    reloadTable,
    buildTableActions,
    selectable,
  };
}
