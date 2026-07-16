import { forwardRef } from 'react';
import DataTablesWrapper from './DataTablesWrapper';

const DataTable = forwardRef(function DataTable(props, ref) {
  return <DataTablesWrapper ref={ref} {...props} />;
});

export default DataTable;
