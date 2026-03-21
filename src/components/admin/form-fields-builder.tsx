"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, ArrowUp, ArrowDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formFieldTypeLabels } from "@/lib/constants";

export interface FormFieldValue {
  id?: string;
  type: "TEXT" | "YES_NO" | "SINGLE_CHOICE";
  label: string;
  options: string[];
  required: boolean;
}

interface FormFieldsBuilderProps {
  fields: FormFieldValue[];
  onChange: (fields: FormFieldValue[]) => void;
  maxFields?: number;
}

export function FormFieldsBuilder({ fields, onChange, maxFields = 20 }: FormFieldsBuilderProps) {
  const [expanded, setExpanded] = useState(fields.length > 0);

  function addField() {
    if (fields.length >= maxFields) return;
    onChange([...fields, { type: "TEXT", label: "", options: [], required: false }]);
    setExpanded(true);
  }

  function removeField(index: number) {
    onChange(fields.filter((_, i) => i !== index));
  }

  function updateField(index: number, updates: Partial<FormFieldValue>) {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  }

  function moveField(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const newFields = [...fields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    onChange(newFields);
  }

  function addOption(fieldIndex: number) {
    const field = fields[fieldIndex];
    updateField(fieldIndex, { options: [...field.options, ""] });
  }

  function removeOption(fieldIndex: number, optionIndex: number) {
    const field = fields[fieldIndex];
    updateField(fieldIndex, {
      options: field.options.filter((_, i) => i !== optionIndex),
    });
  }

  function updateOption(fieldIndex: number, optionIndex: number, value: string) {
    const field = fields[fieldIndex];
    const newOptions = [...field.options];
    newOptions[optionIndex] = value;
    updateField(fieldIndex, { options: newOptions });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="flex items-center gap-2 text-lg font-medium hover:text-primary transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
        報名表單設計
        {fields.length > 0 && (
          <Badge variant="secondary" className="ml-1">
            {fields.length} 個欄位
          </Badge>
        )}
      </button>

      {expanded && (
        <div className="space-y-4 pl-2">
          {fields.map((field, index) => (
            <div key={index} className="rounded-md border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">欄位 {index + 1}</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => moveField(index, "up")}
                    disabled={index === 0}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => moveField(index, "down")}
                    disabled={index === fields.length - 1}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeField(index)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">類型</label>
                  <Select
                    value={field.type}
                    onValueChange={(value: "TEXT" | "YES_NO" | "SINGLE_CHOICE") => {
                      const updates: Partial<FormFieldValue> = { type: value };
                      if (value === "SINGLE_CHOICE" && field.options.length < 2) {
                        updates.options = ["", ""];
                      }
                      if (value !== "SINGLE_CHOICE") {
                        updates.options = [];
                      }
                      updateField(index, updates);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(formFieldTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">標籤 *</label>
                  <Input
                    placeholder="例：飲食需求"
                    value={field.label}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id={`required-${index}`}
                  checked={field.required}
                  onCheckedChange={(checked) => updateField(index, { required: checked === true })}
                />
                <label htmlFor={`required-${index}`} className="text-sm">
                  必填
                </label>
              </div>

              {/* Options editor for SINGLE_CHOICE */}
              {field.type === "SINGLE_CHOICE" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">選項 (至少 2 個)</label>
                  {field.options.map((option, optIndex) => (
                    <div key={optIndex} className="flex items-center gap-2">
                      <Input
                        placeholder={`選項 ${optIndex + 1}`}
                        value={option}
                        onChange={(e) => updateOption(index, optIndex, e.target.value)}
                        className="flex-1"
                      />
                      {field.options.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => removeOption(index, optIndex)}
                        >
                          <X className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addOption(index)}
                  >
                    <Plus className="size-4" />
                    新增選項
                  </Button>
                </div>
              )}
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addField}
            disabled={fields.length >= maxFields}
          >
            <Plus className="size-4" />
            新增欄位
            {fields.length >= maxFields && " (已達上限)"}
          </Button>
        </div>
      )}
    </div>
  );
}
