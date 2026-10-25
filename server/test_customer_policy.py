import unittest

from customer_policy import apply_note, proposal_notes


class CustomerPolicyTests(unittest.TestCase):
    base = '# Policy\n## General\n- Hold gift cards.\n## Member notes\n- Alice: groceries.\n- Bob: pharmacy.\n'

    def test_independent_approvals_preserve_each_other(self):
        alice = proposal_notes(self.base, self.base.replace('Alice: groceries.', 'Alice: groceries and bikes.'), 'Alice')
        bob = proposal_notes(self.base, self.base.replace('Bob: pharmacy.', 'Bob: pharmacy and groceries.'), 'Bob')
        current = apply_note(self.base, 'Alice', *alice)
        current = apply_note(current, 'Bob', *bob)
        self.assertIn('Alice: groceries and bikes.', current)
        self.assertIn('Bob: pharmacy and groceries.', current)
        self.assertIn('- Hold gift cards.', current)

    def test_shared_or_other_customer_edits_rejected(self):
        for proposed in [self.base.replace('Hold gift cards.', 'Allow gift cards.'),
                         self.base.replace('Bob: pharmacy.', 'Bob: anything.')]:
            with self.assertRaises(ValueError):
                proposal_notes(self.base, proposed, 'Alice')

    def test_stale_note_rejected(self):
        notes = proposal_notes(self.base, self.base.replace('Alice: groceries.', 'Alice: bikes.'), 'Alice')
        with self.assertRaises(ValueError):
            apply_note(self.base.replace('Alice: groceries.', 'Alice: updated.'), 'Alice', *notes)

    def test_multiline_note_preserves_adjacent_customer(self):
        proposed = self.base.replace('- Alice: groceries.\n', '- Alice: groceries.\n  Bikes around birthdays.\n')
        notes = proposal_notes(self.base, proposed, 'Alice')
        self.assertEqual(apply_note(self.base, 'Alice', *notes), proposed)

    def test_missing_or_ambiguous_note_rejected(self):
        for policy in [self.base.replace('- Alice:', '- Unknown:'), self.base + '- Alice: duplicate.\n']:
            with self.assertRaises(ValueError):
                proposal_notes(policy, policy, 'Alice')


if __name__ == '__main__':
    unittest.main()
