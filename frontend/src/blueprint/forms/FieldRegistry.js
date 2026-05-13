/**
 * Blueprint Form Engine — frontend field registry.
 *
 * Maps server-declared field types to React renderer components.
 * Components receive: { field, value, onChange, locale, error, disabled }
 *
 * Reusable across: lead generation, project onboarding, moodboard approvals,
 * proposal approvals, concierge, surveys, feedback, vendor applications.
 */
import ShortTextField from './fields/ShortTextField';
import LongTextField from './fields/LongTextField';
import EmailField from './fields/EmailField';
import PhoneField from './fields/PhoneField';
import SingleChoiceField from './fields/SingleChoiceField';
import MultiChoiceField from './fields/MultiChoiceField';
import StyleCardsField from './fields/StyleCardsField';
import SliderField from './fields/SliderField';
import BudgetSliderField from './fields/BudgetSliderField';
import TimelinePickerField from './fields/TimelinePickerField';
import ScaleField from './fields/ScaleField';
import FileUploadField from './fields/FileUploadField';
import ConsentField from './fields/ConsentField';
import StatementField from './fields/StatementField';

export const FIELD_COMPONENTS = {
  short_text:        ShortTextField,
  long_text:         LongTextField,
  email:             EmailField,
  phone:             PhoneField,
  country:           ShortTextField,
  single_choice:     SingleChoiceField,
  multi_choice:      MultiChoiceField,
  style_cards:       StyleCardsField,
  mood_cards:        StyleCardsField,
  image_choice:      SingleChoiceField,
  slider:            SliderField,
  budget_slider:     BudgetSliderField,
  timeline_picker:   TimelinePickerField,
  scale:             ScaleField,
  file_upload:       FileUploadField,
  consent:           ConsentField,
  statement:         StatementField,
};

export function resolveField(type) {
  return FIELD_COMPONENTS[type] || null;
}

/** Pick locale-appropriate value from i18n label map. */
export function resolveI18n(value, locale, fallback = 'en-US') {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[locale] || value[fallback] || value._default || value['en-US'] || Object.values(value)[0] || '';
}

/** Visibility rule evaluator — mirrors backend evaluate_conditional. */
export function evaluateVisibility(rule, answers) {
  if (!rule || !rule.field) return true;
  const op = rule.op || 'equals';
  const target = answers[rule.field];
  const val = rule.value;
  switch (op) {
    case 'equals':     return target === val;
    case 'not_equals': return target !== val;
    case 'in':         return Array.isArray(val) && val.includes(target);
    case 'not_in':     return Array.isArray(val) && !val.includes(target);
    case 'gt':         return parseFloat(target) > parseFloat(val);
    case 'lt':         return parseFloat(target) < parseFloat(val);
    case 'truthy':     return !!target;
    default:           return true;
  }
}
