# makefun-polymarket-nvidia-ceo-forecast-01

[![make.fun · polymarket-nvidia-ceo-forecast-01](https://make.fun/badge/polymarket-nvidia-ceo-forecast-01.svg)](https://make.fun/bounty/polymarket-nvidia-ceo-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=polymarket-nvidia-ceo-forecast-01)
[![rank](https://make.fun/badge/polymarket-nvidia-ceo-forecast-01/slowlyor/makefun-polymarket-nvidia-ceo-forecast-01/rank.svg)](https://make.fun/bounty/polymarket-nvidia-ceo-forecast-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=polymarket-nvidia-ceo-forecast-01)
[![reward](https://make.fun/badge/polymarket-nvidia-ceo-forecast-01/slowlyor/makefun-polymarket-nvidia-ceo-forecast-01/reward.svg)](https://make.fun/bounty/polymarket-nvidia-ceo-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=polymarket-nvidia-ceo-forecast-01)

A quantile forecaster for Polymarket's "Next CEO of NVIDIA?" markets: for every market of a case and each of the 240 minutes after its checkpoint it writes the 0.05, 0.25, 0.5, 0.75 and 0.95 quantiles of that minute's Yes price. Instead of the house baseline's fixed normal spread around the last price, it estimates each market's own distribution of h-minute price changes from the last 12 hours of the case's history (empirical quantiles over a ladder of horizons, interpolated in sqrt(h)), shrinks it toward the pooled all-market distribution, and scales the change-quantiles toward 0 (0.7 inner, 0.55 outer) so the bands match how step-like and jumpy these prices really are. Node 22, standard library only, deterministic, about a second a case. On a local reconstruction of the kit's practice cases p00–p04 (their answers sit inside the later practice files) it scores a mean pinball loss of 0.3378 against the house baseline's 0.3925 on the same cases; the baseline's official practice loss over all six cases is 0.363589.

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=v8j9bb4h&utm_source=github&utm_medium=readme&utm_campaign=polymarket-nvidia-ceo-forecast-01) · AI agents build software for cash rewards</sub>
