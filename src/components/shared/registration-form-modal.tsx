"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export interface FormFieldForDisplay {
  id: string;
  type: "TEXT" | "YES_NO" | "SINGLE_CHOICE";
  label: string;
  options: string[];
  required: boolean;
  sortOrder: number;
}

export interface FormResponseForDisplay {
  fieldId: string;
  value: string;
}

interface RegistrationFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formFields: FormFieldForDisplay[];
  existingResponses?: FormResponseForDisplay[];
  onSubmit: (responses: { fieldId: string; value: string }[]) => Promise<void>;
  isSubmitting: boolean;
}

export function RegistrationFormModal({
  open,
  onOpenChange,
  formFields,
  existingResponses,
  onSubmit,
  isSubmitting,
}: RegistrationFormModalProps) {
  const isReadOnly = !!existingResponses;
  const sortedFields = [...formFields].sort((a, b) => a.sortOrder - b.sortOrder);

  // Initialize values from existing responses or empty
  const initialValues: Record<string, string> = {};
  if (existingResponses) {
    for (const r of existingResponses) {
      initialValues[r.fieldId] = r.value;
    }
  }

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset state when modal opens to prevent stale values from previous attempts
  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function updateValue(fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    // Clear error on change
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    for (const field of sortedFields) {
      const value = values[field.id] ?? "";
      if (field.required && value.trim() === "") {
        newErrors[field.id] = "此欄位為必填";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    const responses = sortedFields
      .map((f) => ({ fieldId: f.id, value: values[f.id] ?? "" }))
      .filter((r) => r.value !== "");
    await onSubmit(responses);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isReadOnly ? "您的報名資料" : "報名表單"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {sortedFields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label>
                {field.label}
                {field.required && <span className="text-destructive ml-0.5">*</span>}
              </Label>

              {field.type === "TEXT" && (
                <Input
                  value={values[field.id] ?? ""}
                  onChange={(e) => updateValue(field.id, e.target.value)}
                  disabled={isReadOnly}
                  placeholder={field.required ? "必填" : "選填"}
                />
              )}

              {field.type === "YES_NO" && (
                <RadioGroup
                  value={values[field.id] ?? ""}
                  onValueChange={(v) => updateValue(field.id, v)}
                  disabled={isReadOnly}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="是" id={`${field.id}-yes`} />
                    <Label htmlFor={`${field.id}-yes`} className="font-normal">
                      是
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="否" id={`${field.id}-no`} />
                    <Label htmlFor={`${field.id}-no`} className="font-normal">
                      否
                    </Label>
                  </div>
                </RadioGroup>
              )}

              {field.type === "SINGLE_CHOICE" && (
                <RadioGroup
                  value={values[field.id] ?? ""}
                  onValueChange={(v) => updateValue(field.id, v)}
                  disabled={isReadOnly}
                  className="space-y-2"
                >
                  {field.options.map((option) => (
                    <div key={option} className="flex items-center gap-2">
                      <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                      <Label htmlFor={`${field.id}-${option}`} className="font-normal">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {errors[field.id] && <p className="text-sm text-destructive">{errors[field.id]}</p>}
            </div>
          ))}
        </div>

        {!isReadOnly && (
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
              {isSubmitting ? "報名中..." : "確認報名"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
