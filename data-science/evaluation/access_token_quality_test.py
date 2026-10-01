import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.core.config import get_settings
from app.core.security import require_internal_token


class InternalTokenQualityTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.environment = patch.dict(os.environ, {"DS_INTERNAL_TOKEN": "quality-test-token"})
        self.environment.start()
        get_settings.cache_clear()

    async def asyncTearDown(self):
        get_settings.cache_clear()
        self.environment.stop()

    async def test_direct_access_without_internal_token_is_rejected(self):
        with self.assertRaises(HTTPException) as result:
            await require_internal_token(None, None)
        self.assertEqual(result.exception.status_code, 401)

    async def test_access_with_valid_internal_token_is_allowed(self):
        await require_internal_token("Bearer quality-test-token", None)


if __name__ == "__main__":
    unittest.main(verbosity=2)
