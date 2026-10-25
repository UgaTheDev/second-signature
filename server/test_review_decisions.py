"""Exercise real decision handling with external service clients replaced by mocks."""
import asyncio
import importlib.util
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import AsyncMock, Mock, patch


class ReviewDecisionTests(unittest.TestCase):
    def test_customer_decisions_and_stale_requests(self):
        sdk = types.ModuleType('droid_sdk')
        for name in ('ApplyPatchAction', 'AssistantMessage', 'Autonomy', 'CreateFile', 'Document',
                     'EditAction', 'InteractionHandlers', 'PermissionRequest', 'Session',
                     'SessionConfig', 'ToolConfirmationOutcome'):
            setattr(sdk, name, Mock())
        store = types.ModuleType('store')
        store.review_set = AsyncMock()
        with patch.dict('sys.modules', {'droid_sdk': sdk, 'store': store,
                                      'loguru': types.SimpleNamespace(logger=Mock())}):
            spec = importlib.util.spec_from_file_location('review_under_test', Path(__file__).with_name('review.py'))
            review = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(review)
        with tempfile.TemporaryDirectory() as tmp:
            review.POLICY = Path(tmp) / 'policy.md'
            base = '- Alice: old.\n- Bob: old.\n'
            review.POLICY.write_text(base)
            review._pending.update(review_id='r1', customers=[
                {'member_id': 'a', 'member_name': 'Alice', 'status': 'proposed'},
                {'member_id': 'b', 'member_name': 'Bob', 'status': 'proposed'}], proposals={
                'a': {'base': '- Alice: old.\n', 'new': '- Alice: new.\n'},
                'b': {'base': '- Bob: old.\n', 'new': '- Bob: new.\n'}})

            async def check():
                self.assertIsNotNone(await review.decide(True, 'stale-review', 'a'))
                self.assertIsNotNone(await review.decide(True, 'r1', 'unknown'))
                self.assertEqual(review.POLICY.read_text(), base)
                self.assertIsNone(await review.decide(True, 'r1', 'a'))
                self.assertEqual(review.POLICY.read_text(), '- Alice: new.\n- Bob: old.\n')
                self.assertEqual(review._pending['customers'][1]['status'], 'proposed')
                self.assertIsNotNone(await review.decide(True, 'r1', 'a'))
                self.assertIsNone(await review.decide(False, 'r1', 'b'))
                self.assertEqual(review.POLICY.read_text(), '- Alice: new.\n- Bob: old.\n')
                self.assertEqual(review._pending['customers'][1]['status'], 'rejected')
                self.assertEqual(store.review_set.call_args.args[1], 'completed')

            asyncio.run(check())


if __name__ == '__main__':
    unittest.main()
