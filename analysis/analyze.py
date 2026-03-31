#!/usr/bin/env python3
"""
Rezo Haptic Metronome — Research Analysis Pipeline
====================================================
Computes standard sensorimotor synchronization (SMS) metrics from tapping
task data exported by the Rezo app.

Usage
-----
  # Analyze a single participant file
  python analyze.py data/P001.csv

  # Analyze all CSV files in a directory
  python analyze.py data/

  # Specify output directory
  python analyze.py data/ --output results/

Outputs (in output_dir/)
------------------------
  summary.csv          — Per-trial metrics for all participants
  group_summary.csv    — Condition-level means ± SD across participants
  plots/               — One folder of figures per participant + group plots

Metrics computed
----------------
  mean_async_ms        — Mean signed asynchrony (tap − cue) per phase (ms)
                         Negative = anticipatory tapping (common in musicians)
  sd_async_ms          — SD of asynchrony per phase (ms)  [consistency]
  mean_iti_ms          — Mean inter-tap interval (ms)
  sd_iti_ms            — SD of inter-tap interval (ms)    [rhythmic variability]
  mean_isi_ms          — Mean inter-stimulus interval (ms) [actual tempo delivered]
  adaptation_beats     — Beats to converge to new ISI after perturbation
                         (defined as first beat where |ITI − target_ISI| < 1 SD)
  continuation_drift_ms— Linear drift in ITI across continuation phase (ms/beat)
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')   # headless rendering
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import seaborn as sns
from scipy import stats
from scipy.stats import shapiro

# ─── Constants ────────────────────────────────────────────────────────────────

CONDITION_META = {
    'A': dict(name='Baseline',        bpm1=80,  bpm2=80,  has_perturb=False),
    'B': dict(name='Accel +25%',      bpm1=80,  bpm2=100, has_perturb=True),
    'C': dict(name='Decel −20%',      bpm1=80,  bpm2=64,  has_perturb=True),
    'D': dict(name='Fast Baseline',   bpm1=100, bpm2=100, has_perturb=False),
    'E': dict(name='Decel from Fast', bpm1=120, bpm2=96,  has_perturb=True),
}

PHASE_ORDER = ['SYNC', 'PERTURB', 'CONTINUATION']

sns.set_theme(style='darkgrid', palette='muted', font_scale=1.1)
COLORS = {
    'SYNC':         '#6C63FF',
    'PERTURB':      '#F5A623',
    'CONTINUATION': '#4ECDC4',
}

# ─── Loading ──────────────────────────────────────────────────────────────────

def load_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    required = {
        'participant_id', 'trial_number', 'condition',
        'event_type', 'beat_number', 'phase',
        'firmware_timestamp_ms', 'app_timestamp_ms', 'asynchrony_ms',
    }
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{path.name}: missing columns: {missing}")
    df['condition'] = df['condition'].astype(str).str.strip()
    df['phase'] = df['phase'].astype(str).str.strip()
    df['event_type'] = df['event_type'].astype(str).str.strip()
    return df


def load_all(input_path: Path) -> pd.DataFrame:
    if input_path.is_file():
        paths = [input_path]
    else:
        paths = sorted(input_path.glob('*.csv'))
    if not paths:
        sys.exit(f"No CSV files found in {input_path}")
    dfs = [load_csv(p) for p in paths]
    df = pd.concat(dfs, ignore_index=True)
    print(f"Loaded {len(df)} events from {len(paths)} file(s) "
          f"({df['participant_id'].nunique()} participant(s), "
          f"{len(df.groupby(['participant_id','trial_number']))} trial(s))")
    return df


# ─── Per-trial metrics ────────────────────────────────────────────────────────

def compute_itis(tap_timestamps: np.ndarray) -> np.ndarray:
    """Inter-tap intervals from sorted tap timestamps."""
    if len(tap_timestamps) < 2:
        return np.array([])
    return np.diff(np.sort(tap_timestamps))


def compute_isis(cue_timestamps: np.ndarray) -> np.ndarray:
    """Inter-stimulus intervals from sorted CUE timestamps."""
    if len(cue_timestamps) < 2:
        return np.array([])
    return np.diff(np.sort(cue_timestamps))


def compute_adaptation_beats(
    perturb_itis: np.ndarray,
    target_isi_ms: float,
    window: int = 3,
) -> int | None:
    """
    Number of inter-tap intervals in the PERTURB phase until the participant
    converges to the new target ISI.

    Convergence criterion: mean of `window` consecutive ITIs within 1 SD of
    target_isi_ms (using the SYNC-phase SD as the baseline tolerance).
    """
    if len(perturb_itis) < window:
        return None
    target_sd = max(target_isi_ms * 0.05, 20)  # at least 20 ms tolerance
    for i in range(len(perturb_itis) - window + 1):
        chunk = perturb_itis[i:i + window]
        if abs(np.mean(chunk) - target_isi_ms) <= target_sd:
            return i + window  # beat index at which convergence is reached
    return len(perturb_itis)  # never converged within trial


def compute_continuation_drift(cont_itis: np.ndarray) -> float | None:
    """
    Linear drift in ITI across the continuation phase (ms/beat).
    Positive = speeding up (ITIs shrinking), negative = slowing down.
    """
    if len(cont_itis) < 3:
        return None
    x = np.arange(len(cont_itis))
    slope, _, _, _, _ = stats.linregress(x, cont_itis)
    return float(slope)


def trial_metrics(trial_df: pd.DataFrame) -> dict:
    meta = trial_df.iloc[0]
    cond_key = str(meta['condition'])
    cond = CONDITION_META.get(cond_key, {})
    target_isi_ms = 60_000 / cond.get('bpm2', 80)
    sync_target_isi_ms = 60_000 / cond.get('bpm1', 80)

    metrics: dict = {
        'participant_id': meta['participant_id'],
        'trial_number': int(meta['trial_number']),
        'condition': cond_key,
        'condition_name': cond.get('name', cond_key),
        'bpm1': cond.get('bpm1'),
        'bpm2': cond.get('bpm2'),
    }

    for phase in PHASE_ORDER:
        phase_df = trial_df[trial_df['phase'] == phase]

        # Asynchrony (TAP events only)
        tap_async = phase_df.loc[
            (phase_df['event_type'] == 'TAP') & (phase_df['asynchrony_ms'].notna()),
            'asynchrony_ms',
        ].values.astype(float)

        metrics[f'n_taps_{phase.lower()}'] = len(tap_async)
        metrics[f'mean_async_{phase.lower()}_ms'] = float(np.mean(tap_async)) if len(tap_async) else np.nan
        metrics[f'sd_async_{phase.lower()}_ms'] = float(np.std(tap_async, ddof=1)) if len(tap_async) > 1 else np.nan

        # ITI
        tap_ts = phase_df.loc[phase_df['event_type'] == 'TAP', 'app_timestamp_ms'].values.astype(float)
        itis = compute_itis(tap_ts)
        metrics[f'mean_iti_{phase.lower()}_ms'] = float(np.mean(itis)) if len(itis) else np.nan
        metrics[f'sd_iti_{phase.lower()}_ms'] = float(np.std(itis, ddof=1)) if len(itis) > 1 else np.nan

        # ISI
        cue_ts = phase_df.loc[phase_df['event_type'] == 'CUE', 'app_timestamp_ms'].values.astype(float)
        isis = compute_isis(cue_ts)
        metrics[f'mean_isi_{phase.lower()}_ms'] = float(np.mean(isis)) if len(isis) else np.nan

    # Adaptation rate (perturb phase only, if condition has perturbation)
    if cond.get('has_perturb'):
        perturb_taps = trial_df[trial_df['phase'] == 'PERTURB']
        perturb_tap_ts = perturb_taps.loc[
            perturb_taps['event_type'] == 'TAP', 'app_timestamp_ms'
        ].values.astype(float)
        perturb_itis = compute_itis(perturb_tap_ts)
        metrics['adaptation_beats'] = compute_adaptation_beats(perturb_itis, target_isi_ms)
    else:
        metrics['adaptation_beats'] = np.nan

    # Continuation drift
    cont_taps = trial_df[trial_df['phase'] == 'CONTINUATION']
    cont_tap_ts = cont_taps.loc[
        cont_taps['event_type'] == 'TAP', 'app_timestamp_ms'
    ].values.astype(float)
    cont_itis = compute_itis(cont_tap_ts)
    metrics['continuation_drift_ms_per_beat'] = compute_continuation_drift(cont_itis)

    return metrics


def compute_all_metrics(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for (pid, trial_num), trial_df in df.groupby(['participant_id', 'trial_number']):
        rows.append(trial_metrics(trial_df))
    return pd.DataFrame(rows).sort_values(['participant_id', 'trial_number']).reset_index(drop=True)


# ─── Group summary ────────────────────────────────────────────────────────────

def group_summary(metrics_df: pd.DataFrame) -> pd.DataFrame:
    numeric_cols = metrics_df.select_dtypes(include='number').columns.tolist()
    numeric_cols = [c for c in numeric_cols if c not in ('trial_number',)]
    agg = metrics_df.groupby(['condition', 'condition_name'])[numeric_cols].agg(
        ['mean', 'std', 'count']
    )
    agg.columns = ['_'.join(c) for c in agg.columns]
    return agg.reset_index()


# ─── Plotting ─────────────────────────────────────────────────────────────────

def plot_participant(participant_df: pd.DataFrame, metrics_df: pd.DataFrame, out_dir: Path):
    pid = participant_df['participant_id'].iloc[0]
    out_dir.mkdir(parents=True, exist_ok=True)

    fig = plt.figure(figsize=(18, 14))
    fig.suptitle(f'Participant {pid} — Rezo Tapping Task', fontsize=16, fontweight='bold', y=0.98)
    gs = gridspec.GridSpec(3, 3, figure=fig, hspace=0.5, wspace=0.4)

    conditions = sorted(participant_df['condition'].unique())

    # ── 1. Asynchrony per condition × phase (boxplot) ──
    ax1 = fig.add_subplot(gs[0, :2])
    tap_data = participant_df[participant_df['event_type'] == 'TAP'].copy()
    tap_data = tap_data[tap_data['asynchrony_ms'].notna()]
    if not tap_data.empty:
        cond_order = [c for c in 'ABCDE' if c in tap_data['condition'].unique()]
        sns.boxplot(
            data=tap_data, x='condition', y='asynchrony_ms', hue='phase',
            order=cond_order, hue_order=PHASE_ORDER,
            palette={p: COLORS[p] for p in PHASE_ORDER},
            ax=ax1, linewidth=0.8,
        )
        ax1.axhline(0, color='white', linestyle='--', alpha=0.5, linewidth=1)
        ax1.set_title('Asynchrony by Condition and Phase')
        ax1.set_xlabel('Condition')
        ax1.set_ylabel('Asynchrony (ms)\n[negative = anticipatory]')
        ax1.legend(loc='upper right', fontsize=9)

    # ── 2. Adaptation curves (ITI over beat, perturb conditions) ──
    ax2 = fig.add_subplot(gs[0, 2])
    perturb_conds = [c for c in conditions if CONDITION_META.get(c, {}).get('has_perturb')]
    for cond_key in perturb_conds:
        cond_df = participant_df[
            (participant_df['condition'] == cond_key) &
            (participant_df['event_type'] == 'TAP')
        ].sort_values('app_timestamp_ms')
        tap_ts = cond_df['app_timestamp_ms'].values.astype(float)
        if len(tap_ts) < 3:
            continue
        itis = np.diff(tap_ts)
        ax2.plot(range(1, len(itis) + 1), itis,
                 marker='o', markersize=4, linewidth=1.5,
                 label=f"{cond_key}: {CONDITION_META[cond_key]['name']}")
        target_isi = 60_000 / CONDITION_META[cond_key]['bpm2']
        ax2.axhline(target_isi, linestyle=':', alpha=0.7)
    ax2.set_title('ITI over Trial\n(perturb conditions)')
    ax2.set_xlabel('Tap #')
    ax2.set_ylabel('ITI (ms)')
    if perturb_conds:
        ax2.legend(fontsize=7, loc='upper right')

    # ── 3. Mean asynchrony per condition (bar) ──
    ax3 = fig.add_subplot(gs[1, :2])
    pmdf = metrics_df[metrics_df['participant_id'] == pid]
    async_cols = [c for c in pmdf.columns if 'mean_async' in c and 'ms' in c]
    if not pmdf.empty and async_cols:
        plot_data = pmdf.set_index('condition')[async_cols]
        plot_data.columns = [c.replace('mean_async_', '').replace('_ms', '').upper() for c in async_cols]
        plot_data = plot_data.reindex(sorted(plot_data.index))
        plot_data.plot(kind='bar', ax=ax3, color=[COLORS.get(c, '#888') for c in plot_data.columns])
        ax3.axhline(0, color='white', linestyle='--', alpha=0.5, linewidth=1)
        ax3.set_title('Mean Asynchrony per Condition and Phase')
        ax3.set_xlabel('Condition')
        ax3.set_ylabel('Mean Asynchrony (ms)')
        ax3.tick_params(axis='x', rotation=0)
        ax3.legend(loc='upper right', fontsize=9)

    # ── 4. Adaptation beats bar (perturb conditions) ──
    ax4 = fig.add_subplot(gs[1, 2])
    adap_df = pmdf[pmdf['adaptation_beats'].notna() & (pmdf['condition'].isin(perturb_conds))]
    if not adap_df.empty:
        ax4.bar(adap_df['condition'], adap_df['adaptation_beats'],
                color=theme_color('accent'), alpha=0.85)
        ax4.set_title('Adaptation Rate\n(beats to convergence)')
        ax4.set_xlabel('Condition')
        ax4.set_ylabel('Beats')
    else:
        ax4.set_visible(False)

    # ── 5. Continuation drift ──
    ax5 = fig.add_subplot(gs[2, :2])
    cont_df = pmdf[pmdf['continuation_drift_ms_per_beat'].notna()]
    if not cont_df.empty:
        colors = ['#4ECDC4' if v < 0 else '#F5A623' for v in cont_df['continuation_drift_ms_per_beat']]
        ax5.bar(cont_df['condition'], cont_df['continuation_drift_ms_per_beat'], color=colors, alpha=0.85)
        ax5.axhline(0, color='white', linestyle='--', alpha=0.5)
        ax5.set_title('Continuation Drift (ms/beat)\n[negative = slowing, positive = speeding]')
        ax5.set_xlabel('Condition')
        ax5.set_ylabel('Drift (ms/beat)')
    else:
        ax5.set_visible(False)

    # ── 6. Asynchrony distribution (KDE) ──
    ax6 = fig.add_subplot(gs[2, 2])
    tap_data_all = participant_df[
        (participant_df['event_type'] == 'TAP') &
        (participant_df['asynchrony_ms'].notna())
    ]
    if not tap_data_all.empty:
        for phase in PHASE_ORDER:
            phase_async = tap_data_all[tap_data_all['phase'] == phase]['asynchrony_ms'].values
            if len(phase_async) > 2:
                sns.kdeplot(phase_async, ax=ax6, label=phase, color=COLORS[phase], linewidth=2)
        ax6.axvline(0, color='white', linestyle='--', alpha=0.5)
        ax6.set_title('Asynchrony Distribution')
        ax6.set_xlabel('Asynchrony (ms)')
        ax6.legend(fontsize=9)

    plt.savefig(out_dir / f'{pid}_summary.png', dpi=150, bbox_inches='tight',
                facecolor='#0A0A10')
    plt.close(fig)
    print(f"  Saved: {out_dir / f'{pid}_summary.png'}")


def plot_group(metrics_df: pd.DataFrame, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)

    fig, axes = plt.subplots(1, 3, figsize=(18, 6))
    fig.suptitle('Group-Level Results — Rezo Tapping Task', fontsize=15, fontweight='bold')

    # ── 1. Mean asynchrony by condition (across participants) ──
    ax = axes[0]
    for phase in PHASE_ORDER:
        col = f'mean_async_{phase.lower()}_ms'
        if col not in metrics_df.columns:
            continue
        grp = metrics_df.groupby('condition')[col].agg(['mean', 'sem']).reset_index()
        grp = grp.sort_values('condition')
        ax.errorbar(
            grp['condition'], grp['mean'], yerr=grp['sem'],
            label=phase, color=COLORS[phase], marker='o', linewidth=2, capsize=4,
        )
    ax.axhline(0, color='grey', linestyle='--', alpha=0.5)
    ax.set_title('Mean Asynchrony by Condition')
    ax.set_xlabel('Condition')
    ax.set_ylabel('Mean Asynchrony (ms)')
    ax.legend(fontsize=9)

    # ── 2. Adaptation beats by condition ──
    ax = axes[1]
    adap_df = metrics_df[metrics_df['adaptation_beats'].notna()]
    if not adap_df.empty:
        grp = adap_df.groupby('condition')['adaptation_beats'].agg(['mean', 'sem']).reset_index()
        ax.bar(grp['condition'], grp['mean'], yerr=grp['sem'],
               color=theme_color('accent'), alpha=0.85, capsize=4)
        ax.set_title('Adaptation Rate\n(mean ± SEM across participants)')
        ax.set_xlabel('Condition')
        ax.set_ylabel('Beats to convergence')
    else:
        ax.set_visible(False)

    # ── 3. SD of asynchrony (consistency) by condition × phase ──
    ax = axes[2]
    for phase in PHASE_ORDER:
        col = f'sd_async_{phase.lower()}_ms'
        if col not in metrics_df.columns:
            continue
        grp = metrics_df.groupby('condition')[col].agg(['mean', 'sem']).reset_index()
        grp = grp.sort_values('condition')
        ax.errorbar(
            grp['condition'], grp['mean'], yerr=grp['sem'],
            label=phase, color=COLORS[phase], marker='s', linewidth=2, capsize=4,
        )
    ax.set_title('Asynchrony SD (Consistency)\nLower = more consistent')
    ax.set_xlabel('Condition')
    ax.set_ylabel('SD of Asynchrony (ms)')
    ax.legend(fontsize=9)

    for ax in axes:
        ax.set_facecolor('#13131C')
    fig.patch.set_facecolor('#0A0A10')

    plt.tight_layout()
    out_path = out_dir / 'group_summary.png'
    plt.savefig(out_path, dpi=150, bbox_inches='tight', facecolor='#0A0A10')
    plt.close(fig)
    print(f"  Saved: {out_path}")


def theme_color(name: str) -> str:
    return {'accent': '#6C63FF', 'success': '#4ECDC4', 'error': '#FF6584'}.get(name, '#6C63FF')


# ─── Statistical tests ────────────────────────────────────────────────────────

def run_stats(metrics_df: pd.DataFrame) -> pd.DataFrame:
    """
    One-way repeated-measures ANOVA equivalent:
    For each metric, test whether condition significantly predicts the metric
    across participants using a mixed-effects approach (one-way ANOVA per
    participant as repeated measure).

    Returns a summary table of F-statistics and p-values.
    """
    results = []
    test_cols = [
        'mean_async_sync_ms', 'sd_async_sync_ms',
        'mean_iti_sync_ms', 'sd_iti_sync_ms',
        'adaptation_beats', 'continuation_drift_ms_per_beat',
    ]
    conditions = sorted(metrics_df['condition'].unique())

    for col in test_cols:
        if col not in metrics_df.columns:
            continue
        groups = [
            metrics_df[metrics_df['condition'] == c][col].dropna().values
            for c in conditions
        ]
        groups = [g for g in groups if len(g) >= 2]
        if len(groups) < 2:
            continue
        try:
            f_stat, p_val = stats.f_oneway(*groups)
            results.append({
                'metric': col,
                'F_statistic': round(f_stat, 3),
                'p_value': round(p_val, 4),
                'significant_p05': p_val < 0.05,
            })
        except Exception:
            pass

    return pd.DataFrame(results)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Rezo Haptic Metronome — SMS Tapping Task Analysis'
    )
    parser.add_argument('input', type=Path, help='CSV file or directory of CSV files')
    parser.add_argument('--output', type=Path, default=Path('results'),
                        help='Output directory (default: ./results)')
    args = parser.parse_args()

    out_dir = args.output
    out_dir.mkdir(parents=True, exist_ok=True)
    plots_dir = out_dir / 'plots'

    print(f"\n{'='*60}")
    print(f"  Rezo Tapping Task Analysis")
    print(f"{'='*60}\n")

    # Load data
    df = load_all(args.input)

    # Per-trial metrics
    print("\nComputing trial metrics...")
    metrics_df = compute_all_metrics(df)
    metrics_path = out_dir / 'summary.csv'
    metrics_df.to_csv(metrics_path, index=False)
    print(f"  Saved: {metrics_path}")

    # Group summary
    group_df = group_summary(metrics_df)
    group_path = out_dir / 'group_summary.csv'
    group_df.to_csv(group_path, index=False)
    print(f"  Saved: {group_path}")

    # Statistical tests
    stats_df = run_stats(metrics_df)
    if not stats_df.empty:
        stats_path = out_dir / 'statistics.csv'
        stats_df.to_csv(stats_path, index=False)
        print(f"  Saved: {stats_path}")
        print("\nStatistical tests (one-way ANOVA across conditions):")
        print(stats_df.to_string(index=False))

    # Per-participant plots
    print("\nGenerating plots...")
    for pid, pid_df in df.groupby('participant_id'):
        pid_metrics = metrics_df[metrics_df['participant_id'] == pid]
        plot_participant(pid_df, pid_metrics, plots_dir / str(pid))

    # Group plot
    if metrics_df['participant_id'].nunique() > 1:
        plot_group(metrics_df, plots_dir)

    # Console summary
    print(f"\n{'─'*60}")
    print("Per-trial summary:\n")
    display_cols = [
        'participant_id', 'trial_number', 'condition', 'condition_name',
        'mean_async_sync_ms', 'sd_async_sync_ms',
        'adaptation_beats', 'continuation_drift_ms_per_beat',
    ]
    display_cols = [c for c in display_cols if c in metrics_df.columns]
    pd.set_option('display.max_columns', None)
    pd.set_option('display.width', 120)
    pd.set_option('display.float_format', '{:.1f}'.format)
    print(metrics_df[display_cols].to_string(index=False))
    print(f"\n{'─'*60}")
    print(f"Output written to: {out_dir.resolve()}")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    main()
