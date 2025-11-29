'use client';

import React from 'react';
import Select, { type SingleValue, type StylesConfig, type GroupBase } from 'react-select';

export interface SelectOption {
  value: string;
  label: string;
  badge?: string;
  badgeColor?: 'blue' | 'green' | 'gray';
}

interface SimpleSelectProps {
  options: SelectOption[];
  value: string | undefined | null;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  height?: 'sm' | 'md';
  includeNone?: boolean;
  noneLabel?: string;
}

// Primary green color from the app
const PRIMARY_COLOR = '#00897B';
const PRIMARY_LIGHT = '#e0f2f1';

// Custom styles matching ColumnSelector
const getCustomStyles = (
  height: 'sm' | 'md'
): StylesConfig<SelectOption, false, GroupBase<SelectOption>> => ({
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
  singleValue: (base) => ({
    ...base,
    color: '#1f2937',
    fontSize: height === 'sm' ? '13px' : '14px',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
  noOptionsMessage: (base) => ({
    ...base,
    color: '#9ca3af',
    fontSize: '13px',
    padding: '10px',
  }),
});

// Badge color classes
const BADGE_COLORS = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  gray: 'bg-gray-100 text-gray-800',
};

// Custom option component with badge support
const formatOptionLabel = (option: SelectOption) => {
  if (option.badge) {
    return (
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${BADGE_COLORS[option.badgeColor || 'gray']}`}
        >
          {option.badge}
        </span>
        <span>{option.label}</span>
      </div>
    );
  }
  return option.label;
};

export function SimpleSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled,
  className,
  height = 'sm',
  includeNone = false,
  noneLabel = 'None',
}: SimpleSelectProps) {
  // Build options with optional "None" option
  const allOptions: SelectOption[] = [
    ...(includeNone ? [{ value: '__none__', label: noneLabel }] : []),
    ...options,
  ];

  // Find current selected option
  const selectedOption =
    value && value !== '__none__'
      ? allOptions.find((opt) => opt.value === value) || null
      : includeNone && !value
        ? allOptions.find((opt) => opt.value === '__none__') || null
        : null;

  const handleChange = (option: SingleValue<SelectOption>) => {
    if (option) {
      onChange(option.value === '__none__' ? undefined : option.value);
    } else {
      onChange(undefined);
    }
  };

  const customStyles = getCustomStyles(height);

  return (
    <div className={className}>
      <Select<SelectOption, false>
        instanceId={`simple-select-${placeholder}`}
        value={selectedOption}
        onChange={handleChange}
        options={allOptions}
        isDisabled={disabled}
        placeholder={placeholder}
        noOptionsMessage={() => 'No options'}
        styles={customStyles}
        formatOptionLabel={formatOptionLabel}
        menuPortalTarget={null}
        menuPosition="absolute"
        menuPlacement="auto"
        isSearchable={false}
        blurInputOnSelect={true}
        closeMenuOnSelect={true}
        classNamePrefix="simple-select"
      />
    </div>
  );
}
