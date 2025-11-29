'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Select, {
  type SingleValue,
  type MultiValue,
  type StylesConfig,
  type GroupBase,
} from 'react-select';
import { Input } from '@/components/ui/input';
import { useColumnValues } from '@/hooks/api/useChart';
import debounce from 'lodash/debounce';

interface ValueOption {
  value: string;
  label: string;
}

interface SearchableValueInputProps {
  schema?: string;
  table?: string;
  column: string;
  operator: string;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}

// Primary green color from the app
const PRIMARY_COLOR = '#00897B';
const PRIMARY_LIGHT = '#e0f2f1';

// Custom styles for react-select
const getCustomStyles = (
  isMulti: boolean
): StylesConfig<ValueOption, typeof isMulti, GroupBase<ValueOption>> => ({
  container: (base) => ({
    ...base,
    position: 'relative',
    flex: 1,
  }),
  control: (base, state) => ({
    ...base,
    minHeight: '32px',
    height: isMulti ? 'auto' : '32px',
    borderColor: state.isFocused ? PRIMARY_COLOR : '#e5e7eb',
    boxShadow: state.isFocused ? `0 0 0 1px ${PRIMARY_COLOR}` : 'none',
    '&:hover': {
      borderColor: state.isFocused ? PRIMARY_COLOR : '#d1d5db',
    },
    borderRadius: '6px',
    backgroundColor: state.isDisabled ? '#f9fafb' : '#ffffff',
    fontSize: '13px',
    cursor: state.isDisabled ? 'not-allowed' : 'pointer',
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '0 6px',
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
    color: state.isSelected ? '#ffffff' : '#1f2937',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '8px 10px',
    borderRadius: '4px',
    '&:active': {
      backgroundColor: state.isSelected ? PRIMARY_COLOR : '#d1d5db',
    },
  }),
  singleValue: (base) => ({
    ...base,
    color: '#1f2937',
    fontSize: '13px',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: PRIMARY_LIGHT,
    borderRadius: '4px',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: '#1f2937',
    fontSize: '12px',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: '#6b7280',
    '&:hover': {
      backgroundColor: PRIMARY_COLOR,
      color: '#ffffff',
    },
  }),
  input: (base) => ({
    ...base,
    color: '#1f2937',
    fontSize: '13px',
    margin: 0,
    padding: 0,
  }),
  placeholder: (base) => ({
    ...base,
    color: '#9ca3af',
    fontSize: '13px',
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: '#9ca3af',
    padding: '2px 4px',
    transition: 'transform 0.2s',
    transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : undefined,
    '&:hover': {
      color: '#6b7280',
    },
    svg: {
      width: '16px',
      height: '16px',
    },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: '#9ca3af',
    padding: '2px',
    cursor: 'pointer',
    '&:hover': {
      color: '#ef4444',
    },
    svg: {
      width: '14px',
      height: '14px',
    },
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: '#9ca3af',
    fontSize: '13px',
    padding: '10px',
  }),
});

/**
 * SearchableValueInput - Filter value input with autocomplete
 *
 * Fetches column values from the warehouse and provides:
 * - Searchable dropdown when values are available
 * - Multi-select for 'in' and 'not_in' operators
 * - Fallback to text input when no values available
 * - No input for 'is_null' and 'is_not_null' operators
 * - Debounced input to prevent excessive parent updates
 */
export const SearchableValueInput = React.memo(function SearchableValueInput({
  schema,
  table,
  column,
  operator,
  value,
  onChange,
  disabled,
}: SearchableValueInputProps) {
  // Local state for input value (debounced before calling onChange)
  const [localValue, setLocalValue] = useState(value || '');

  // Sync local value when external value changes
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  // Simple debounced onChange with 300ms delay
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedOnChange = useCallback(
    debounce((newValue: string) => {
      onChange(newValue);
    }, 300),
    [onChange]
  );

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    debouncedOnChange(newValue);
  };

  // Get column values using the warehouse API
  const { data: columnValues } = useColumnValues(schema || null, table || null, column || null);

  // Convert column values to options
  const options: ValueOption[] = useMemo(() => {
    if (!columnValues) return [];
    return columnValues
      .filter((val) => val !== null && val !== undefined && val.toString().trim() !== '')
      .slice(0, 100)
      .map((val) => ({
        value: val.toString(),
        label: val.toString(),
      }));
  }, [columnValues]);

  // Styles
  const singleStyles = useMemo(() => getCustomStyles(false), []);
  const multiStyles = useMemo(() => getCustomStyles(true), []);

  // For null checks, no value input needed
  if (operator === 'is_null' || operator === 'is_not_null') {
    return null;
  }

  // For 'in' and 'not_in' operators, show multiselect dropdown if we have column values
  if (operator === 'in' || operator === 'not_in') {
    if (options.length > 0) {
      const selectedValues = Array.isArray(value)
        ? value
        : value
          ? value.split(',').map((v: string) => v.trim())
          : [];

      const selectedOptions = options.filter((opt) => selectedValues.includes(opt.value));

      const handleMultiChange = (newValue: MultiValue<ValueOption>) => {
        const values = newValue.map((opt) => opt.value);
        onChange(values.join(', '));
      };

      return (
        <Select<ValueOption, true>
          instanceId={`value-multi-select-${column}`}
          isMulti
          value={selectedOptions}
          onChange={handleMultiChange}
          options={options}
          isDisabled={disabled}
          placeholder="Select values..."
          noOptionsMessage={() => 'No values found'}
          styles={multiStyles as StylesConfig<ValueOption, true, GroupBase<ValueOption>>}
          menuPortalTarget={null}
          menuPosition="absolute"
          menuPlacement="auto"
          isSearchable={true}
          isClearable
          closeMenuOnSelect={false}
          classNamePrefix="value-select"
        />
      );
    } else {
      // Fallback to text input for in/not_in when no column values
      return (
        <Input
          type="text"
          placeholder="value1, value2, value3"
          value={localValue}
          onChange={handleInputChange}
          disabled={disabled}
          className="h-8 flex-1"
        />
      );
    }
  }

  // If we have column values, show searchable dropdown
  if (options.length > 0) {
    const selectedOption = options.find((opt) => opt.value === value) || null;

    const handleSingleChange = (newValue: SingleValue<ValueOption>) => {
      onChange(newValue?.value || '');
    };

    return (
      <Select<ValueOption, false>
        instanceId={`value-single-select-${column}`}
        value={selectedOption}
        onChange={handleSingleChange}
        options={options}
        isDisabled={disabled}
        placeholder="Select or type value..."
        noOptionsMessage={() => 'No values found'}
        styles={singleStyles as StylesConfig<ValueOption, false, GroupBase<ValueOption>>}
        menuPortalTarget={null}
        menuPosition="absolute"
        menuPlacement="auto"
        isSearchable={true}
        isClearable
        classNamePrefix="value-select"
      />
    );
  }

  // Fallback to regular input
  return (
    <Input
      type="text"
      placeholder="Enter value"
      value={localValue}
      onChange={handleInputChange}
      disabled={disabled}
      className="h-8 flex-1"
    />
  );
});
