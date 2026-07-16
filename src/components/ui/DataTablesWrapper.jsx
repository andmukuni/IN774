import { useEffect, useImperativeHandle, useMemo, useRef, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from 'datatables.net-dt';
import 'datatables.net-responsive-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import 'datatables.net-responsive-dt/css/responsive.dataTables.css';
import '../../styles/datatables.css';
import { getApiBase } from '../../utils/apiBase';
import { getAdminAuthHeaders } from '../../utils/authHeaders';
import { escapeHtml } from '../../utils/datatableHelpers';

const API_BASE = getApiBase();

const EMPTY_COLUMNS = [];
const EMPTY_DATA = [];
const EMPTY_AJAX_PARAMS = {};
const DEFAULT_LENGTH_MENU = [10, 25, 50, 100];

function toSelectedSet(selectedIds) {
  if (selectedIds instanceof Set) return selectedIds;
  return new Set((selectedIds || []).map(String));
}

function buildDtColumns(columns = []) {
  return columns.map((col) => {
    const def = {
      data: 'data' in col ? col.data : col.key,
      title: col.label ?? col.title ?? col.key,
      orderable: col.orderable !== false && col.sortable !== false,
      className: col.className || (col.align === 'right' ? 'dt-right' : 'dt-left'),
      defaultContent: col.defaultContent ?? '',
    };

    if (col.render) {
      def.render = (data, type, row, meta) => {
        if (type === 'display' || type === 'filter') {
          const result = col.render(data, row, meta);
          if (result == null) return '';
          return String(result);
        }
        return data ?? '';
      };
    }

    return def;
  });
}

const DataTablesWrapper = forwardRef(function DataTablesWrapper({
  columns = EMPTY_COLUMNS,
  data = EMPTY_DATA,
  serverSide = false,
  ajaxUrl = '',
  ajaxParams = EMPTY_AJAX_PARAMS,
  pageLength = 25,
  lengthMenu = DEFAULT_LENGTH_MENU,
  emptyTitle = 'No data found',
  onRowClick,
  getRowHref,
  rowClickable = true,
  onRowDelete,
  className = '',
  tableKey = 'default',
  selectable = null,
  frozen = false,
}, ref) {
  const containerRef = useRef(null);
  const tableRef = useRef(null);
  const dtRef = useRef(null);
  const frozenRef = useRef(frozen);
  const navigate = useNavigate();
  const onRowClickRef = useRef(onRowClick);
  const getRowHrefRef = useRef(getRowHref);
  const onRowDeleteRef = useRef(onRowDelete);
  const selectableRef = useRef(selectable);
  const ajaxParamsRef = useRef(ajaxParams);
  const selectedIdsRef = useRef(toSelectedSet(selectable?.selectedIds));
  onRowClickRef.current = onRowClick;
  getRowHrefRef.current = getRowHref;
  onRowDeleteRef.current = onRowDelete;
  selectableRef.current = selectable;
  ajaxParamsRef.current = ajaxParams;
  frozenRef.current = frozen;

  const updatePageInfo = (api) => {
    const containerEl = containerRef.current;
    if (!api || !containerEl) return;
    const info = containerEl.querySelector('.dt-info');
    if (!info) return;
    const pageInfo = api.page.info();
    const start = pageInfo.recordsDisplay > 0 ? pageInfo.start + 1 : 0;
    const end = Math.min(pageInfo.start + pageInfo.length, pageInfo.recordsDisplay);
    info.textContent = `Showing ${start} to ${end} of ${pageInfo.recordsDisplay} entries`;
  };

  const decrementServerSideCounts = (api) => {
    const settings = api?.settings?.()?.[0];
    if (!settings?.oFeatures?.bServerSide) return;
    const dec = (value) => Math.max(0, Number(value || 0) - 1);
    if (settings.json) {
      settings.json.recordsTotal = dec(settings.json.recordsTotal);
      settings.json.recordsFiltered = dec(settings.json.recordsFiltered);
    }
    if (typeof settings._iRecordsDisplay === 'number') {
      settings._iRecordsDisplay = dec(settings._iRecordsDisplay);
    }
    if (typeof settings._iRecordsTotal === 'number') {
      settings._iRecordsTotal = dec(settings._iRecordsTotal);
    }
  };

  const selectionColumn = useMemo(() => {
    if (!selectable) return null;
    return {
      key: '__select__',
      data: null,
      label: '<input type="checkbox" class="dt-select-all" aria-label="Select all on this page" />',
      orderable: false,
      sortable: false,
      className: 'dt-select-cell',
      render: (data, row) => {
        const config = selectableRef.current;
        if (!config) return '';
        const idKey = config.idKey || 'uuid';
        const record = row && typeof row === 'object' ? row : {};
        const id = String(record[idKey] ?? '');
        if (!id) return '';
        const isSelectable = !config.isRowSelectable || config.isRowSelectable(record);
        if (!isSelectable) return '';
        const checked = selectedIdsRef.current.has(id) ? ' checked' : '';
        const disabled = config.disabled ? ' disabled' : '';
        return `<input type="checkbox" class="dt-row-select" data-id="${escapeHtml(id)}" aria-label="Select row"${checked}${disabled} />`;
      },
    };
  }, [Boolean(selectable)]);

  const effectiveColumns = useMemo(
    () => (selectionColumn ? [selectionColumn, ...columns] : columns),
    [columns, selectionColumn],
  );

  const dtColumns = useMemo(() => buildDtColumns(effectiveColumns), [tableKey, effectiveColumns]);

  const syncSelectionUi = () => {
    const tableEl = tableRef.current;
    const api = dtRef.current;
    const config = selectableRef.current;
    if (!tableEl || !api || !config) return;

    const selected = selectedIdsRef.current;
    tableEl.querySelectorAll('.dt-row-select').forEach((input) => {
      const id = input.getAttribute('data-id');
      input.checked = Boolean(id && selected.has(id));
    });

    const header = tableEl.querySelector('.dt-select-all');
    if (!header) return;

    if (config.disabled) {
      header.disabled = true;
      header.checked = false;
      header.indeterminate = false;
      return;
    }

    const idKey = config.idKey || 'uuid';
    const pageRows = api.rows({ page: 'current' }).data().toArray().filter(
      (row) => !config.isRowSelectable || config.isRowSelectable(row),
    );
    if (!pageRows.length) {
      header.checked = false;
      header.indeterminate = false;
      header.disabled = true;
      return;
    }
    header.disabled = false;
    const selectedOnPage = pageRows.filter((row) => selected.has(String(row[idKey])));
    header.checked = selectedOnPage.length === pageRows.length;
    header.indeterminate = selectedOnPage.length > 0 && selectedOnPage.length < pageRows.length;
  };

  const emitSelectionChange = () => {
    selectableRef.current?.onSelectionChange?.(new Set(selectedIdsRef.current));
  };

  const activateRowRef = useRef(() => {});
  activateRowRef.current = (row, tr) => {
    if (onRowClickRef.current) {
      onRowClickRef.current(row, tr);
      return;
    }
    const href = getRowHrefRef.current?.(row);
    if (href) {
      navigate(href);
      return;
    }
    const link = tr?.querySelector('a[href]');
    if (link?.href) {
      navigate(link.getAttribute('href'));
      return;
    }
    tr.parentElement?.querySelectorAll('tr.dt-row-selected').forEach((el) => el.classList.remove('dt-row-selected'));
    tr.classList.add('dt-row-selected');
  };

  useImperativeHandle(ref, () => ({
    reload: (resetPaging = false) => {
      if (frozenRef.current) return;
      dtRef.current?.ajax?.reload(null, resetPaging);
    },
    removeRowById: (id, idKey = 'uuid') => {
      const api = dtRef.current;
      if (!api || id == null || id === '') return false;
      const needle = String(id);
      const matched = api.rows((_, data) => String(data?.[idKey] ?? '') === needle);
      if (!matched.any()) return false;

      selectedIdsRef.current.delete(needle);
      matched.nodes().to$().addClass('dt-row-removing');
      window.setTimeout(() => {
        try {
          matched.remove();
          decrementServerSideCounts(api);
          updatePageInfo(api);
          syncSelectionUi();
          emitSelectionChange();
        } catch {
          // Ignore row removal errors during bulk updates.
        }
      }, 160);
      return true;
    },
    api: () => dtRef.current,
    clearSelection: () => {
      selectedIdsRef.current = new Set();
      syncSelectionUi();
      emitSelectionChange();
    },
  }));

  useEffect(() => {
    selectedIdsRef.current = toSelectedSet(selectable?.selectedIds);
    syncSelectionUi();
  }, [selectable?.selectedIds]);

  useEffect(() => {
    if (!selectable || !dtRef.current) return;
    syncSelectionUi();
  }, [selectable?.disabled]);

  useEffect(() => {
    const tableEl = tableRef.current;
    const containerEl = containerRef.current;
    if (!tableEl || !containerEl) return undefined;

    let ajaxGeneration = 0;

    const options = {
      columns: dtColumns,
      pageLength,
      lengthMenu,
      responsive: true,
      order: [],
      layout: {
        topStart: null,
        topEnd: null,
        bottomStart: 'info',
        bottomEnd: 'paging',
      },
      pagingType: 'simple_numbers',
      paging: {
        firstLast: false,
      },
      rowCallback: (row) => {
        if (rowClickable) row.classList.add('dt-row-clickable');
      },
      drawCallback: () => {
        syncSelectionUi();
      },
      language: {
        emptyTable: emptyTitle,
        zeroRecords: emptyTitle,
        search: 'Search:',
        lengthMenu: 'Show _MENU_ entries',
        info: 'Showing _START_ to _END_ of _TOTAL_ entries',
        infoEmpty: 'Showing 0 entries',
        paginate: {
          next: '',
          previous: '',
        },
      },
    };

    if (serverSide && ajaxUrl) {
      options.serverSide = true;
      options.processing = true;
      options.ajax = (reqData, callback) => {
        const generation = ajaxGeneration;
        const params = new URLSearchParams();
        params.set('draw', String(reqData.draw));
        params.set('start', String(reqData.start));
        params.set('length', String(reqData.length));
        if (reqData.search?.value) params.set('search[value]', reqData.search.value);
        if (reqData.order?.[0]) {
          params.set('order[0][column]', String(reqData.order[0].column));
          params.set('order[0][dir]', reqData.order[0].dir);
        }
        Object.entries(ajaxParamsRef.current || {}).forEach(([k, v]) => {
          if (v != null && v !== '') params.set(k, String(v));
        });

        const sep = ajaxUrl.includes('?') ? '&' : '?';
        const url = `${API_BASE}${ajaxUrl}${sep}${params.toString()}`;

        fetch(url, { headers: getAdminAuthHeaders(), cache: 'no-store' })
          .then((res) => res.json())
          .then((json) => {
            if (generation !== ajaxGeneration) return;
            if (!json?.ok) {
              callback({ draw: reqData.draw, recordsTotal: 0, recordsFiltered: 0, data: [] });
              return;
            }
            callback({
              draw: json.draw ?? reqData.draw,
              recordsTotal: json.recordsTotal ?? json.pagination?.total ?? 0,
              recordsFiltered: json.recordsFiltered ?? json.pagination?.total ?? 0,
              data: json.data ?? [],
            });
          })
          .catch(() => {
            if (generation !== ajaxGeneration) return;
            callback({ draw: reqData.draw, recordsTotal: 0, recordsFiltered: 0, data: [] });
          });
      };
    } else {
      options.data = data;
    }

    dtRef.current = new DataTable(tableEl, options);

    const onClickRow = (e) => {
      const deleteBtn = e.target.closest('.dt-row-delete');
      if (deleteBtn) {
        e.preventDefault();
        const id = deleteBtn.getAttribute('data-id');
        const label = deleteBtn.getAttribute('data-label');
        if (id && onRowDeleteRef.current) {
          onRowDeleteRef.current(id, label);
        }
        return;
      }

      if (e.target.matches('.dt-row-select, .dt-select-all')) return;
      if (!rowClickable) return;
      const tr = e.target.closest('tbody tr');
      if (!tr || e.target.closest('a, button, input, select, label, .dt-actions')) return;
      const row = dtRef.current?.row(tr)?.data();
      if (!row) return;
      activateRowRef.current(row, tr);
    };

    const onSelectionChange = (e) => {
      const config = selectableRef.current;
      if (!config || config.disabled) return;

      const idKey = config.idKey || 'uuid';
      const target = e.target;

      if (target.matches('.dt-select-all')) {
        const pageRows = dtRef.current?.rows({ page: 'current' }).data().toArray().filter(
          (row) => !config.isRowSelectable || config.isRowSelectable(row),
        ) || [];
        const next = new Set(selectedIdsRef.current);
        for (const row of pageRows) {
          const id = String(row[idKey] ?? '');
          if (!id) continue;
          if (target.checked) next.add(id);
          else next.delete(id);
        }
        selectedIdsRef.current = next;
        syncSelectionUi();
        emitSelectionChange();
        return;
      }

      if (target.matches('.dt-row-select')) {
        const id = target.getAttribute('data-id');
        if (!id) return;
        const next = new Set(selectedIdsRef.current);
        if (target.checked) next.add(id);
        else next.delete(id);
        selectedIdsRef.current = next;
        syncSelectionUi();
        emitSelectionChange();
      }
    };

    containerEl.addEventListener('click', onClickRow);
    containerEl.addEventListener('change', onSelectionChange);

    return () => {
      ajaxGeneration += 1;
      containerEl.removeEventListener('click', onClickRow);
      containerEl.removeEventListener('change', onSelectionChange);
      if (dtRef.current) {
        try {
          dtRef.current.destroy();
        } catch {
          // Ignore teardown errors when columns/DOM change during re-init.
        }
        dtRef.current = null;
      }
    };
  }, [
    tableKey,
    serverSide,
    ajaxUrl,
    JSON.stringify(ajaxParams),
    dtColumns,
    serverSide ? null : data,
    pageLength,
    emptyTitle,
    rowClickable,
    navigate,
    Boolean(selectable),
  ]);

  return (
    <div ref={containerRef} className={`dt-container overflow-hidden ${className}`}>
      {/* DataTables owns thead/tbody — React must not render row children or it wipes the grid on re-render. */}
      <table ref={tableRef} className="display w-full" style={{ width: '100%' }} />
    </div>
  );
});

export default DataTablesWrapper;
