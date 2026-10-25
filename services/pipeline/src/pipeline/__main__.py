"""Command line: python -m pipeline {sync,backfill,report,receipts}."""

from __future__ import annotations

import argparse
import json
import logging
import sys

import structlog

from pipeline.config import Settings


def _configure_logging() -> None:
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m pipeline")
    sub = parser.add_subparsers(dest="command", required=True)
    sync = sub.add_parser("sync", help="daily incremental sync (operations by watermark, full diff of the rest)")
    sync.add_argument("--since", help="operations :updated_at watermark override (ISO, UTC)")
    sync.add_argument("--full", action="store_true", help="re-pull every operation")
    replays = sync.add_mutually_exclusive_group()
    replays.add_argument("--replay", type=int, metavar="NON_COMPLIANCE_ID",
                         help="resend a real past finding as a labelled replay, then exit")
    replays.add_argument("--replay-latest", type=int, metavar="OPERATION_ID",
                         help="replay the newest real finding at this daycare, then exit")
    sync.add_argument("--dry-run", action="store_true", help="do everything, then roll back; no pushes")
    sync.add_argument("--no-notify", action="store_true", help="skip sending pushes")
    sub.add_parser("backfill", help="load full history without creating alert events")
    sub.add_parser("report", help="print the latest runs from ops.sync_runs")
    receipts = sub.add_parser("receipts", help="check Expo push receipts now and show the newest sends")
    receipts.add_argument("--min-age", type=int, default=0, metavar="MINUTES",
                          help="only check tickets sent at least this long ago (default 0)")
    args = parser.parse_args(argv)
    _configure_logging()
    settings = Settings.from_env()

    if args.command == "report":
        from pipeline.report import report

        print(json.dumps(report(settings), indent=2, default=str))
        return 0
    if args.command == "receipts":
        from pipeline.notify import receipts_now

        print(json.dumps(receipts_now(settings, args.min_age), indent=2, default=str))
        return 0
    if args.command == "sync" and args.replay is not None:
        from pipeline.notify import replay

        print(json.dumps(replay(settings, args.replay, dry_run=args.dry_run), indent=2, default=str))
        return 0
    if args.command == "sync" and args.replay_latest is not None:
        from pipeline.notify import replay_latest

        print(json.dumps(replay_latest(settings, args.replay_latest, dry_run=args.dry_run), indent=2, default=str))
        return 0

    from pipeline.runner import RunOptions, run

    if args.command == "backfill":
        opts = RunOptions(mode="backfill", full=True, notify=False)
    else:
        opts = RunOptions(mode="sync", full=args.full, since=args.since, dry_run=args.dry_run,
                          notify=not (args.no_notify or args.dry_run))
    run_id = run(settings, opts)
    print(run_id)
    return 0


if __name__ == "__main__":
    sys.exit(main())
