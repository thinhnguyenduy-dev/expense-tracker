import httpx
from decimal import Decimal
from typing import Optional, Dict, Any
from .config import settings
from .logging import get_logger

logger = get_logger()

# Simple mock rates for MVP if no API key is present
# Base is USD
MOCK_RATES = {
    "USD": Decimal("1.0"),
    "VND": Decimal("25350.0"),  # Approx rate
    "EUR": Decimal("0.92"),
    "JPY": Decimal("150.0"),
}

class ExchangeRateService:
    def __init__(self):
        self.api_key = settings.EXCHANGE_RATE_API_KEY
        self.base_url = "https://v6.exchangerate-api.com/v6" # Example using exchangerate-api.com
        self._rates_cache: Dict[str, Dict[str, Any]] = {}

    async def get_exchange_rate(self, from_currency: str, to_currency: str) -> Optional[Decimal]:
        """
        Get exchange rate from `from_currency` to `to_currency`.
        Returns Decimal or None if failed.
        """
        from_currency = from_currency.upper()
        to_currency = to_currency.upper()

        if from_currency == to_currency:
            return Decimal("1.0")

        # MVP: If no API key, use mock rates
        if not self.api_key:
            return self._get_mock_rate(from_currency, to_currency)

        # TODO: Implement actual API call with caching (Redis or memory)
        # For now, sticking to mock/simple logic to avoid external dependencies blocking dev
        return self._get_mock_rate(from_currency, to_currency)

    def _get_mock_rate(self, from_currency: str, to_currency: str) -> Optional[Decimal]:
        logger.warning(f"Using MOCK exchange rates for {from_currency} -> {to_currency}")
        
        # Convert to USD first (Base)
        from_rate_usd = MOCK_RATES.get(from_currency)
        to_rate_usd = MOCK_RATES.get(to_currency)

        if not from_rate_usd or not to_rate_usd:
            logger.error(f"Unsupported currency in mock mode: {from_currency} or {to_currency}")
            return None

        # Calculate cross rate
        # 1 USD = from_rate_usd FROM
        # 1 USD = to_rate_usd TO
        # 1 FROM = (to_rate_usd / from_rate_usd) TO
        
        rate = to_rate_usd / from_rate_usd
        return rate

    async def convert(self, amount: Decimal, from_currency: str, to_currency: str) -> Optional[Decimal]:
        """
        Convert amount from one currency to another.
        """
        rate = await self.get_exchange_rate(from_currency, to_currency)
        if rate is None:
            return None
        
        return amount * rate

exchange_rate_service = ExchangeRateService()
