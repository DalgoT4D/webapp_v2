'use client';

import React, { useState, useRef } from 'react';
import Select, {
  type SingleValue,
  type StylesConfig,
  type GroupBase,
  type InputActionMeta,
} from 'react-select';

export interface ColumnOption {
  value: string;
  label: string;
  data_type: string;
  isDisabled?: boolean;
}

interface ColumnSelectorProps {
  columns: Array<{ column_name: string; data_type: string }>;
  value: string | undefined | null;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  filterFn?: (column: { column_name: string; data_type: string }) => boolean;
  disabledFn?: (column: { column_name: string; data_type: string }) => boolean;
  includeNone?: boolean;
  noneLabel?: string;
  height?: 'sm' | 'md';
}

// Primary green color from the app
const PRIMARY_COLOR = '#00897B';
const PRIMARY_LIGHT = '#e0f2f1';

// Custom styles matching DatasetSelector
const getCustomStyles = (
  height: 'sm' | 'md'
): StylesConfig<ColumnOption, false, GroupBase<ColumnOption>> => ({
  container: (base) => ({
    ...base,
    position: 'relative',
  }),
  control: (base, state) => ({
    ...base,
    minHeight: height === 'sm' ? '32px' : '40px',
    height: height === 'sm' ? '32px' : '40px',
    borderColor: state.isFocused ? PRIMARY_COLOR : '#e5e7eb',
    boxShadow: state.isFocused ? `0 0 0 1px ${PRIMARY_COLOR}` : 'none',
    '&:hover': {
      borderColor: state.isFocused ? PRIMARY_COLOR : '#d1d5db',
    },
    borderRadius: '6px',
    backgroundColor: state.isDisabled ? '#f9fafb' : '#ffffff',
    fontSize: height === 'sm' ? '13px' : '14px',
    cursor: state.isDisabled ? 'not-allowed' : 'pointer',
  }),
  valueContainer: (base) => ({
    ...base,
    padding: height === 'sm' ? '0 6px' : '0 12px',
    overflow: 'hidden',
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
    color: state.isDisabled ? '#9ca3af' : state.isSelected ? '#ffffff' : '#1f2937',
    cursor: state.isDisabled ? 'not-allowed' : 'pointer',
    fontSize: '13px',
    padding: '8px 10px',
    borderRadius: '4px',
    opacity: state.isDisabled ? 0.5 : 1,
    '&:active': {
      backgroundColor: state.isSelected ? PRIMARY_COLOR : '#d1d5db',
    },
  }),
  singleValue: (base, state) => ({
    ...base,
    color: '#1f2937',
    fontSize: height === 'sm' ? '13px' : '14px',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    opacity: state.selectProps.menuIsOpen && state.selectProps.inputValue ? 0 : 1,
    transition: 'opacity 0.1s',
  }),
  input: (base) => ({
    ...base,
    color: '#1f2937',
    fontSize: height === 'sm' ? '13px' : '14px',
    margin: 0,
    padding: 0,
  }),
  placeholder: (base) => ({
    ...base,
    color: '#9ca3af',
    fontSize: height === 'sm' ? '13px' : '14px',
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: '#9ca3af',
    padding: height === 'sm' ? '2px 4px' : '8px',
    transition: 'transform 0.2s',
    transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : undefined,
    '&:hover': {
      color: '#6b7280',
    },
    svg: {
      width: height === 'sm' ? '16px' : '20px',
      height: height === 'sm' ? '16px' : '20px',
    },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: '#9ca3af',
    padding: height === 'sm' ? '2px' : '8px',
    cursor: 'pointer',
    '&:hover': {
      color: '#ef4444',
    },
    svg: {
      width: height === 'sm' ? '14px' : '18px',
      height: height === 'sm' ? '14px' : '18px',
    },
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: '#9ca3af',
    fontSize: '13px',
    padding: '10px',
  }),
});

export function ColumnSelector({
  columns,
  value,
  onChange,
  placeholder = 'Select column...',
  disabled,
  className,
  filterFn,
  disabledFn,
  includeNone = false,
  noneLabel = 'None',
  height = 'md',
}: ColumnSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');

  // Filter columns if filter function provided
  const filteredColumns = filterFn ? columns.filter(filterFn) : columns;

  // Convert columns to react-select options
  const options: ColumnOption[] = [
    ...(includeNone
      ? [{ value: '__none__', label: noneLabel, data_type: '', isDisabled: false }]
      : []),
    ...filteredColumns.map((col) => ({
      value: col.column_name,
      label: col.column_name,
      data_type: col.data_type,
      isDisabled: disabledFn ? disabledFn(col) : false,
    })),
  ];

  // Find current selected option
  const selectedOption =
    value && value !== '__none__'
      ? options.find((opt) => opt.value === value) || null
      : includeNone && !value
        ? options.find((opt) => opt.value === '__none__') || null
        : null;

  const handleChange = (option: SingleValue<ColumnOption>) => {
    if (option) {
      onChange(option.value === '__none__' ? undefined : option.value);
    } else {
      onChange(undefined);
    }
    setInputValue('');
  };

  const handleInputChange = (newValue: string, actionMeta: InputActionMeta) => {
    if (actionMeta.action === 'input-change') {
      setInputValue(newValue);
      // If user clears the input completely via backspace, clear the selection
      if (newValue === '' && selectedOption && selectedOption.value !== '__none__') {
        onChange(undefined);
      }
    }
    if (actionMeta.action === 'menu-close') {
      setInputValue('');
    }
  };

  const handleMenuOpen = () => {
    if (selectedOption && selectedOption.value !== '__none__') {
      setInputValue(selectedOption.label);
      setTimeout(() => {
        const focusedOption = containerRef.current?.querySelector(
          '[class*="option"][class*="is-selected"], [class*="option"][aria-selected="true"]'
        );
        focusedOption?.scrollIntoView({ block: 'nearest' });
      }, 10);
    }
  };

  const filterOption = (option: { data: ColumnOption }, inputVal: string) => {
    if (selectedOption && inputVal === selectedOption.label) {
      return true;
    }
    return option.data.label.toLowerCase().includes(inputVal.toLowerCase());
  };

  const customStyles = getCustomStyles(height);

  return (
    <div className={className} ref={containerRef} style={{ position: 'relative' }}>
      <Select<ColumnOption, false>
        instanceId={`column-selector-${placeholder}`}
        value={selectedOption}
        onChange={handleChange}
        options={options}
        isDisabled={disabled}
        placeholder={placeholder}
        noOptionsMessage={() => 'No columns found'}
        styles={customStyles}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        onMenuOpen={handleMenuOpen}
        filterOption={filterOption}
        isOptionDisabled={(option) => !!option.isDisabled}
        menuPortalTarget={null}
        menuPosition="absolute"
        menuPlacement="auto"
        isClearable={false}
        backspaceRemovesValue={true}
        isSearchable={true}
        openMenuOnFocus={true}
        blurInputOnSelect={true}
        closeMenuOnSelect={true}
        tabSelectsValue={true}
        captureMenuScroll={true}
        menuShouldScrollIntoView={true}
        classNamePrefix="column-select"
      />
    </div>
  );
}
