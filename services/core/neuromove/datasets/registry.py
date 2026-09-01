"""Dataset Registry tracking supported public and local research datasets."""

import logging

from .models import DatasetDefinition
from .provider import DatasetProvider, PhysioNetEEGBCIProvider

logger = logging.getLogger("neuromove.datasets.registry")


class DatasetRegistry:
    """Registry holding all supported dataset providers and their definitions."""

    def __init__(self) -> None:
        self._providers: dict[str, DatasetProvider] = {}
        # Register default authoritative providers
        self.register(PhysioNetEEGBCIProvider())

    def register(self, provider: DatasetProvider) -> None:
        """Register a dataset provider instance."""
        defn = provider.get_definition()
        self._providers[defn.dataset_id] = provider
        logger.info("Registered dataset provider: %s (v%s)", defn.dataset_id, defn.version)

    def get_provider(self, dataset_id: str) -> DatasetProvider:
        """Retrieve a registered provider by dataset_id.

        Raises KeyError if the dataset_id is not registered.
        """
        if dataset_id not in self._providers:
            raise KeyError(f"Dataset '{dataset_id}' is not registered in NeuroMove")
        return self._providers[dataset_id]

    def list_datasets(self) -> list[DatasetDefinition]:
        """Return canonical definitions for all registered datasets."""
        return [provider.get_definition() for provider in self._providers.values()]

    def is_registered(self, dataset_id: str) -> bool:
        """Check if a dataset_id is registered."""
        return dataset_id in self._providers


_global_registry = DatasetRegistry()


def get_dataset_registry() -> DatasetRegistry:
    """Dependency injector for DatasetRegistry."""
    return _global_registry
