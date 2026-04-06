import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

/**
 * Encapsulates the confirm/cancel staging workflow for DatePicker.
 * Returns props that can be spread directly onto a stateless DatePicker.
 */
export function useDatePickerWithConfirm(
  value: Date | undefined,
  onChange: (date: Date | undefined) => void
) {
  const [open, setOpen] = useState(false);
  const [stagedDate, setStagedDate] = useState<Date | undefined>(value);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');

  // Sync staged date when popover opens
  useEffect(() => {
    if (open) {
      setStagedDate(value);
      setEditMode(false);
    }
  }, [open, value]);

  const handleEditSubmit = useCallback(() => {
    const parsed = new Date(editText);
    if (!isNaN(parsed.getTime())) {
      setStagedDate(parsed);
    }
    setEditMode(false);
  }, [editText]);

  const handleConfirm = useCallback(() => {
    onChange(stagedDate);
    setOpen(false);
  }, [onChange, stagedDate]);

  const handleCancel = useCallback(() => {
    setStagedDate(value);
    setOpen(false);
  }, [value]);

  const handleClear = useCallback(() => {
    setStagedDate(undefined);
  }, []);

  const handleEditModeChange = useCallback(
    (editing: boolean) => {
      if (editing) {
        setEditText(stagedDate ? format(stagedDate, 'MM/dd/yyyy') : '');
      }
      setEditMode(editing);
    },
    [stagedDate]
  );

  const handleEditTextChange = useCallback((text: string) => {
    setEditText(text);
  }, []);

  return {
    open,
    onOpenChange: setOpen,
    selected: stagedDate,
    onSelect: setStagedDate,
    showFooter: true as const,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
    onClear: handleClear,
    showEditButton: true as const,
    editMode,
    editText,
    onEditModeChange: handleEditModeChange,
    onEditTextChange: handleEditTextChange,
    onEditSubmit: handleEditSubmit,
  };
}
