# Pilot plan: soil moisture monitoring

This is the pilot for activity **A 2.2**: testing and validating the platform in real conditions, in months 4–5. Its scope is **one feature**: monitoring soil moisture and alerting when irrigation is needed.

## Goal

Show that Greecon Platform can reliably measure soil moisture at a real farm or greenhouse, display it clearly, and warn the farmer in time when the soil becomes too dry.

## Success criteria

| Criterion | Target |
|---|---|
| Data availability | At least 95% of expected readings received (one reading every 10 minutes) |
| Alert correctness | Every drop below the agreed limit raises an alert. There are no false alerts caused by faulty sensors. |
| Usefulness | The farmer confirms that the alerts and the moisture trend helped decide when to irrigate |
| Stability | The station runs for 4 weeks without manual intervention |

## Scope

**In scope**
- 1 site and 1–2 stations, each with 2 soil moisture sensors and a soil temperature sensor.
- The Dashboard, Monitoring, Alerts and Reports modules.
- 1–2 accounts: an Authorized user (read-only) for the farmer, and an Operator for a technician if needed. Both are created by invitation.

**Out of scope**
- Energy and water modules.
- Automatic irrigation control.
- Multiple farms.

## Timeline

| When | Step |
|---|---|
| Month 3 (Oct) | Choose the farm and plot. Buy hardware. Bench test with `devices/emulator` and then the real station. Add email alerts and the Albanian interface on the platform. |
| Month 4 (Nov) | Install at the site and calibrate the sensors. Agree limits with the farmer. Run 4 weeks of monitoring and collect feedback. |
| Month 5 (Dec) | Evaluate against the success criteria. Fix issues. Write the pilot results for D6 and D7. |

## Checklist

**Before installation**
- [ ] Choose the farm and plot, and get the partner's agreement.
- [ ] Check Wi-Fi coverage at the plot, or get a 4G router with a data SIM.
- [ ] Check power at the plot: mains 5 V or a solar kit.
- [ ] Buy hardware (see `devices/esp32-soil-moisture/README.md`).
- [ ] On the platform, set `SEED_DEMO=false` and `SIMULATOR=false`, and delete the demo sites.
- [ ] Create the pilot site and a **Device** source, then copy its API key.
- [ ] Test the key and URL with `python3 devices/emulator/send_test_readings.py --url … --key …`.
- [ ] Flash and bench-test the station, and calibrate the sensors in dry air and in water.

**At installation**
- [ ] Place the sensors in the root zone, at 10–20 cm and 20–40 cm depth, or in two spots.
- [ ] Mount the box shaded and above the irrigation spray, with the cable glands facing down.
- [ ] Confirm that readings arrive on the platform. Check the `wifi_rssi` metric: it should be above −80 dBm.
- [ ] Set lower limits with the farmer (start at 25–30%).
- [ ] Create operator accounts for the farmer or technician, and show them the dashboard and alerts.

**Weekly during the pilot**
- [ ] Check data availability under **Reports** for the last 7 days.
- [ ] Review the alerts and note what action the farmer took.
- [ ] Note feedback and any issues (for D5).

## Platform work before the pilot (month 3)

1. **Email alerts**: done. New alerts and "station offline" are emailed in English and Albanian. See the README, section *Email alerts*.
2. **Albanian interface** for farm users: not done. The dashboard is English only for the pilot; the emails are bilingual, and the farmer's contact point is the email, not the dashboard.
3. **Accounts by invitation and an in-app setup guide**: done. See the README sections *Setup guide* and *Accounts and invitations*.
4. **Per-site access** for partner accounts: not done. It is not needed while the pilot has a single farm. Revisit it before a second partner joins.

The step-by-step setup for the project manager, with where to buy each part, is in [`pilot-setup-guide.pdf`](pilot-setup-guide.pdf). The hands-on build tutorial for the technician, from an empty desk to a working station, is in [`station-build-tutorial.pdf`](station-build-tutorial.pdf).
