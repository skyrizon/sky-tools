import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField,
  type PDFField,
} from "pdf-lib";
import { rectFromPdf } from "@/lib/pdf-studio/geometry";
import type { FormValue, FormWidget } from "@/lib/pdf-studio/types";

/**
 * Lists the fillable fields in a PDF with the page and display rectangle of
 * each widget, plus the values currently stored in the file.
 */
export async function readFormFields(
  file: File,
): Promise<{ widgets: FormWidget[]; values: Record<string, FormValue> }> {
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const form = doc.getForm();
  const pages = doc.getPages();
  const widgets: FormWidget[] = [];
  const values: Record<string, FormValue> = {};

  const pageIndexOf = (widgetDict: object, pageRef: unknown): number => {
    const direct = pages.findIndex((p) => p.ref === pageRef);
    if (direct >= 0) return direct;
    const ref = doc.context.getObjectRef(widgetDict as never);
    return pages.findIndex((p) => p.node.Annots()?.asArray().some((a) => a === ref));
  };

  let fields: PDFField[] = [];
  try {
    fields = form.getFields();
  } catch {
    return { widgets, values };
  }

  for (const field of fields) {
    const name = field.getName();
    const type =
      field instanceof PDFTextField
        ? "text"
        : field instanceof PDFCheckBox
          ? "checkbox"
          : field instanceof PDFDropdown
            ? "dropdown"
            : field instanceof PDFRadioGroup
              ? "radio"
              : null;
    if (!type) continue;

    const radioOptions = field instanceof PDFRadioGroup ? field.getOptions() : [];
    field.acroField.getWidgets().forEach((widget, i) => {
      const pageIndex = pageIndexOf(widget.dict, widget.P());
      if (pageIndex < 0) return;
      const page = pages[pageIndex];
      const r = widget.getRectangle();
      widgets.push({
        key: type === "radio" ? `${name}#${i}` : name,
        fieldName: name,
        type,
        pageIndex,
        rect: rectFromPdf(r, page.getCropBox(), page.getRotation().angle),
        options: field instanceof PDFDropdown ? field.getOptions() : undefined,
        radioValue: type === "radio" ? radioOptions[i] : undefined,
        multiline: field instanceof PDFTextField ? field.isMultiline() : undefined,
      });
    });

    if (field instanceof PDFTextField) values[name] = field.getText() ?? "";
    else if (field instanceof PDFCheckBox) values[name] = field.isChecked();
    else if (field instanceof PDFDropdown) values[name] = field.getSelected()[0] ?? "";
    else if (field instanceof PDFRadioGroup) values[name] = field.getSelected() ?? "";
  }

  return { widgets, values };
}

/** Writes values into a loaded document's form (by field name). */
export function applyFormValues(doc: PDFDocument, values: Record<string, FormValue>): void {
  const form = doc.getForm();
  for (const [name, value] of Object.entries(values)) {
    let field: PDFField | undefined;
    try {
      field = form.getField(name);
    } catch {
      continue;
    }
    try {
      if (field instanceof PDFTextField) field.setText(String(value));
      else if (field instanceof PDFCheckBox) {
        if (value) field.check();
        else field.uncheck();
      }
      else if (field instanceof PDFDropdown && value) field.select(String(value));
      else if (field instanceof PDFRadioGroup && value) field.select(String(value));
    } catch {
      // A value the field doesn't accept (e.g. text too long) is skipped rather than failing the save.
    }
  }
}
