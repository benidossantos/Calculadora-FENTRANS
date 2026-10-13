import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from app import create_app  # noqa: E402
from services.dados_service import BaseReferencia  # noqa: E402


@pytest.fixture(scope="session")
def base():
    return BaseReferencia.carregar()


@pytest.fixture()
def cliente():
    return create_app().test_client()
