"""Developer and researcher CLI for public EEG dataset management."""

import argparse
import json
import sys

from .service import get_dataset_service


def main() -> None:
    """Entrypoint for the dataset CLI tool."""
    parser = argparse.ArgumentParser(
        prog="neuromove-dataset",
        description="NeuroMove Public EEG Dataset & Research Workspace CLI",
    )
    subparsers = parser.add_subparsers(dest="command", help="Dataset commands")

    # list command
    subparsers.add_parser("list", help="List registered public EEG datasets")

    # inspect command
    inspect_parser = subparsers.add_parser(
        "inspect", help="Inspect dataset metadata and recordings"
    )
    inspect_parser.add_argument("--dataset", default="physionet-eegbci", help="Dataset identifier")

    # download command
    download_parser = subparsers.add_parser(
        "download", help="Download specific dataset subjects/runs into local cache"
    )
    download_parser.add_argument("--dataset", default="physionet-eegbci", help="Dataset identifier")
    download_parser.add_argument(
        "--subject", default="public_subject_001", help="Subject identifier"
    )
    download_parser.add_argument("--run", default="R04", help="Run identifier (e.g., R04)")

    # verify command
    verify_parser = subparsers.add_parser(
        "verify", help="Verify checksum integrity of cached dataset files"
    )
    verify_parser.add_argument("--dataset", default="physionet-eegbci", help="Dataset identifier")

    args = parser.parse_args()
    service = get_dataset_service()

    if args.command == "list":
        datasets = service.get_datasets()
        print(f"\nRegistered EEG Datasets ({len(datasets)}):")
        print("=" * 70)
        for d in datasets:
            print(f"ID:        {d.dataset_id}")
            print(f"Name:      {d.name}")
            print(f"Provider:  {d.provider}")
            print(f"License:   {d.license}")
            print(f"Subjects:  {d.subjects_count} | Modality: {d.modality}")
            print(f"Status:    {d.cache_status.value}")
            print("-" * 70)

    elif args.command == "inspect":
        try:
            defn = service.get_dataset(args.dataset)
            subjects = service.get_subjects(args.dataset)
            recs = service.get_recordings(args.dataset)
            print(f"\nDataset Inspection: {defn.name} ({defn.dataset_id})")
            print("=" * 70)
            print(f"Version:      {defn.version}")
            print(f"Reference:    {defn.source_reference}")
            print(f"License:      {defn.license}")
            print(f"Cache Status: {defn.cache_status.value}")
            print(f"Total Subjects:   {len(subjects)}")
            print(f"Total Recordings: {len(recs)}")
            print("\nAvailable Tasks:")
            for t in defn.tasks:
                print(f"  - {t}")
            print("\nSample Recording (first):")
            if recs:
                r = recs[0]
                print(f"  ID:          {r.recording_id}")
                print(f"  Subject:     {r.subject_id} ({r.source_subject_id})")
                print(f"  Run:         {r.run_id} ({r.normalized_task_label})")
                print(f"  Sample Rate: {r.sample_rate_hz} Hz | Channels: {r.channel_count}")
                print(f"  Events:      {r.event_count}")
                print(f"  Status:      {r.cache_status.value}")
            print("=" * 70)
        except Exception as e:
            print(f"Error inspecting dataset: {e}", file=sys.stderr)
            sys.exit(1)

    elif args.command == "download":
        try:
            print(f"Downloading {args.dataset} [Subject: {args.subject}, Run: {args.run}]...")
            recs = service.download_recordings(
                dataset_id=args.dataset,
                subject_ids=[args.subject],
                run_ids=[args.run],
            )
            print(f"Downloaded {len(recs)} recording(s):")
            for r in recs:
                print(f"  - {r.recording_id} (SHA-256: {r.checksum_sha256[:16]}...)")
        except Exception as e:
            print(f"Error downloading dataset: {e}", file=sys.stderr)
            sys.exit(1)

    elif args.command == "verify":
        try:
            res = service.verify_dataset(args.dataset)
            print(f"\nChecksum Verification Result for '{args.dataset}':")
            print(json.dumps(res, indent=2))
        except Exception as e:
            print(f"Error verifying dataset: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
