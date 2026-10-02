// Maison's segmented control (#29): iOS's one-of-a-few picker on React Aria's
// ToggleButtonGroup, which makes it a radiogroup of radio buttons with arrow
// key focus, and its SelectionIndicator, which slides the selected thumb from
// the old segment to the new one (instantly under reduced motion, where
// --m-dur-control is 0ms).
//
// Today's value (read, not changed): the house override's ends, climate.js
// HouseControl `{kind: 'override', …, endsLabel: 'Override ends', ends:
// Control[]}`. Each end is `{intent: {command: 'house-end', entity: '1h' |
// '3h' | 'next'}, label, selected, enabled}`: exactly one is selected (the
// draft's end, else 'next', else the first), and all are disabled together
// while offline, busy or not editable. Two or three of them, so an empty list
// draws no control (the caller skips it, as the page does today).
import {ToggleButtonGroup} from 'react-aria-components/ToggleButtonGroup';
import {ToggleButton} from 'react-aria-components/ToggleButton';
import {SelectionIndicator} from 'react-aria-components/SelectionIndicator';
import {useCommand} from '../contexts.js';

/**
 * A segmented control: one of `items` is selected, and pressing another sends
 * its intent. It keeps no state: the value says what is selected next render.
 *
 * - `selectionMode="single"`, `disallowEmptySelection`, `selectedKeys` from
 *   the selected item's index, `aria-label=ariaLabel`.
 * - One ToggleButton per item, keyed by index; `isDisabled=!item.enabled`.
 *   With every item disabled the group is disabled too (`data-disabled`).
 * - Selecting an item sends `command(item.intent)` through useCommand().
 *
 * Keyboard: React Aria's toolbar model, on purpose. The group is one Tab stop
 * (Tab enters on the first segment, or the one last focused, and Tab leaves);
 * the arrow keys move focus between segments without selecting; Space or
 * Enter selects the focused one. Each selection sends a command (a house end
 * is a write to the draft), so arrowing across must not send one per
 * segment, as a radio group whose selection follows focus would.
 *
 * DOM: `div.m-segmented[role=radiogroup]` holding one
 * `button.m-segmented__item.m-focusable[role=radio][aria-checked]` per item,
 * each holding the selected one's `div.m-segmented__thumb` and
 * `span.m-segmented__label`.
 *
 * Look: 32 high with 2px padding, --m-radius-segment, --m-fill-gray. Items
 * share the width equally (the control fills its container: give it a class to
 * size it otherwise); labels are footnote-strong in --m-label, --m-label-3 when
 * disabled. The selected thumb is --m-segment-thumb with its shadow, radius 7.
 * A hairline separates two unselected neighbours, as on iOS.
 *
 * @param {object} props
 * @param {string} props.ariaLabel The group's name (HouseControl.endsLabel).
 * @param {{intent: object, label: string, selected?: boolean, enabled: boolean}[]} props.items
 * @param {string} [props.className]
 */
export function SegmentedControl({ariaLabel, items, className}) {
  const command = useCommand();
  const selected = items.findIndex(item => item.selected);
  const select = keys => {
    const [key] = keys;
    if (key !== undefined && key !== selected) command(items[key].intent);
  };
  return <ToggleButtonGroup className={className ? `m-segmented ${className}` : 'm-segmented'} aria-label={ariaLabel} selectionMode="single" disallowEmptySelection
    selectedKeys={selected < 0 ? [] : [selected]} onSelectionChange={select} isDisabled={items.every(item => !item.enabled)}>
    {items.map((item, index) => <ToggleButton key={index} id={index} className="m-segmented__item m-focusable" isDisabled={!item.enabled}>
      <SelectionIndicator className="m-segmented__thumb"/><span className="m-segmented__label">{item.label}</span>
    </ToggleButton>)}
  </ToggleButtonGroup>;
}
