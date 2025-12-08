'use client';

import React, { useState, useRef } from 'react';
import Select, {
  type SingleValue,
  type StylesConfig,
  type GroupBase,
  type InputActionMeta,
} from 'react-select';
import { useAllSchemaTables } from '@/hooks/api/useChart';

interface DatasetOption {
  value: string;
  label: string;
  schema_name: string;
  table_name: string;
}

interface DatasetSelectorProps {
  schema_name?: string;
  table_name?: string;
  onDatasetChange: (schema_name: string, table_name: string) => void;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

// Primary green color from the app
const PRIMARY_COLOR = '#00897B';
const PRIMARY_LIGHT = '#e0f2f1'; // Light teal for hover

// Custom styles with fixed colors
const customStyles: StylesConfig<DatasetOption, false, GroupBase<DatasetOption>> = {
  container: (base) => ({
    ...base,
    position: 'relative',
  }),
  control: (base, state) => ({
    ...base,
    minHeight: '40px',
    height: '40px',
    borderColor: state.isFocused ? PRIMARY_COLOR : '#e5e7eb',
    boxShadow: state.isFocused ? `0 0 0 2px ${PRIMARY_COLOR}33` : 'none',
    '&:hover': {
      borderColor: state.isFocused ? PRIMARY_COLOR : '#d1d5db',
    },
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    fontSize: '14px',
    cursor: 'pointer',
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '0 12px',
  }),
  menu: (base) => ({
    ...base,
    position: 'absolute',
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    overflow: 'hidden',
    zIndex: 9999,
    marginTop: '4px',
  }),
  menuList: (base) => ({
    ...base,
    padding: '4px',
    maxHeight: '200px',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? PRIMARY_COLOR : state.isFocused ? PRIMARY_LIGHT : '#ffffff',
    color: state.isSelected ? '#ffffff' : '#1f2937',
    cursor: 'pointer',
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: '13px',
    padding: '10px 12px',
    borderRadius: '4px',
    '&:active': {
      backgroundColor: state.isSelected ? PRIMARY_COLOR : '#d1d5db',
    },
  }),
  singleValue: (base, state) => ({
    ...base,
    color: '#1f2937',
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: '13px',
    // Hide when menu is open and user is typing
    opacity: state.selectProps.menuIsOpen && state.selectProps.inputValue ? 0 : 1,
    transition: 'opacity 0.1s',
  }),
  input: (base) => ({
    ...base,
    color: '#1f2937',
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: '13px',
    margin: 0,
    padding: 0,
  }),
  placeholder: (base) => ({
    ...base,
    color: '#9ca3af',
    fontSize: '14px',
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: '#9ca3af',
    padding: '8px',
    transition: 'transform 0.2s',
    transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : undefined,
    '&:hover': {
      color: '#6b7280',
    },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: '#9ca3af',
    padding: '8px',
    cursor: 'pointer',
    '&:hover': {
      color: '#ef4444',
    },
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: '#9ca3af',
    fontSize: '14px',
    padding: '12px',
  }),
  loadingMessage: (base) => ({
    ...base,
    color: '#9ca3af',
    fontSize: '14px',
    padding: '12px',
  }),
  loadingIndicator: (base) => ({
    ...base,
    color: PRIMARY_COLOR,
  }),
};

export function DatasetSelector({
  schema_name,
  table_name,
  onDatasetChange,
  disabled,
  className,
  autoFocus = false,
}: DatasetSelectorProps) {
  const { data: allTables, isLoading, error } = useAllSchemaTables();
  const containerRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');

  // Convert tables to react-select options
  const options: DatasetOption[] =
    allTables?.map((table) => ({
      value: table.full_name,
      label: table.full_name,
      schema_name: table.schema_name,
      table_name: table.table_name,
    })) || [];

  // Find current selected option
  const selectedOption =
    schema_name && table_name
      ? options.find((opt) => opt.schema_name === schema_name && opt.table_name === table_name) ||
        null
      : null;

  const handleChange = (option: SingleValue<DatasetOption>) => {
    if (option) {
      onDatasetChange(option.schema_name, option.table_name);
    } else {
      // Clear selection
      onDatasetChange('', '');
    }
    // Clear the input value after selection
    setInputValue('');
  };

  const handleInputChange = (newValue: string, actionMeta: InputActionMeta) => {
    // Only update input value for user input actions
    if (actionMeta.action === 'input-change') {
      setInputValue(newValue);
    }
    // Clear input when menu closes
    if (actionMeta.action === 'menu-close') {
      setInputValue('');
    }
  };

  const handleMenuOpen = () => {
    // When menu opens, populate input with current selected value
    // so user can edit from the end
    if (selectedOption) {
      setInputValue(selectedOption.label);
      // Scroll to the selected option after a short delay to ensure menu is rendered
      setTimeout(() => {
        const focusedOption = containerRef.current?.querySelector(
          '[class*="option"][class*="is-selected"], [class*="option"][aria-selected="true"]'
        );
        focusedOption?.scrollIntoView({ block: 'nearest' });
      }, 10);
    }
  };

  // Custom filter: show all options when input matches selected value exactly
  const filterOption = (option: { data: DatasetOption }, inputVal: string) => {
    // If input matches selected value exactly, show all options
    if (selectedOption && inputVal === selectedOption.label) {
      return true;
    }
    // Otherwise, filter normally
    return option.data.label.toLowerCase().includes(inputVal.toLowerCase());
  };

  if (error) {
    return (
      <div className={className}>
        <div className="p-3 bg-red-50 rounded border border-red-200 text-sm text-red-600">
          Failed to load datasets. Please try refreshing.
        </div>
      </div>
    );
  }

  return (
    <div className={className} ref={containerRef} style={{ position: 'relative' }}>
      <Select<DatasetOption, false>
        instanceId="dataset-selector"
        value={selectedOption}
        onChange={handleChange}
        options={options}
        isLoading={isLoading}
        isDisabled={disabled || isLoading}
        placeholder={isLoading ? 'Loading...' : 'Search and select dataset...'}
        noOptionsMessage={() => 'No datasets found'}
        loadingMessage={() => 'Loading datasets...'}
        styles={customStyles}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        onMenuOpen={handleMenuOpen}
        filterOption={filterOption}
        // Don't use portal - render menu inline to work inside modals
        menuPortalTarget={null}
        menuPosition="absolute"
        menuPlacement="auto"
        autoFocus={autoFocus}
        isClearable={true}
        backspaceRemovesValue={true}
        isSearchable={true}
        openMenuOnFocus={true}
        blurInputOnSelect={true}
        closeMenuOnSelect={true}
        tabSelectsValue={true}
        captureMenuScroll={true}
        menuShouldScrollIntoView={true}
        classNamePrefix="dataset-select"
      />
    </div>
  );
}
