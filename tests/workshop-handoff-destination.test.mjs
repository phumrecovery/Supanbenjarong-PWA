import assert from 'node:assert/strict';
import { chooseHandoffReviewItem, handoffReviewDestinationLabel } from '../js/workshop.js';

const draft = {};
chooseHandoffReviewItem(draft, 'po', '');
assert.equal(draft.destination, 'store');
assert.equal(handoffReviewDestinationLabel(draft, null), '🏪 เข้าร้าน (ไม่ผูก PO)');

chooseHandoffReviewItem(draft, 'finished', 'SKU-001');
assert.equal(draft.finishedSku, 'SKU-001');
assert.equal(draft.destination, 'store');
assert.equal(handoffReviewDestinationLabel(draft, null), '🏪 เข้าร้าน (ไม่ผูก PO)');

chooseHandoffReviewItem(draft, 'po', '');
assert.equal(draft.finishedSku, 'SKU-001', 'choosing store again must retain its SKU');

chooseHandoffReviewItem(draft, 'po', 'PO-001|||ITEM-1');
assert.equal(draft.preorderKey, 'PO-001|||ITEM-1');
assert.equal(draft.finishedSku, '', 'a real PO uses its own SKU');
chooseHandoffReviewItem(draft, 'finished', 'SKU-002');
assert.equal(draft.destination, 'store');
assert.equal(draft.preorderKey, '');
assert.equal(draft.finishedSku, 'SKU-002');

console.log('PASS: store destination and finished SKU survive either selection order');
