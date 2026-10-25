# daycares_near: before and after

Migration `supabase/migrations/20261025170000_near_lean.sql`, Oct 25 2026. Measured on the local database with the full state load (14,310 daycares), at a point in Frisco (33.0198, -96.6989), 10 km.

| | Before | After |
|---|---|---|
| Rows | up to 200 | up to 150 |
| Columns | 18 | 13: id, name, type, city, lat, lng, distance, last visit, findings in 24 months, in TX-04, district basis, visit strip, geocode quality |
| Response at 10 km, uncompressed | 131,298 bytes (cloud) | 81,449 bytes (local) |
| Response, gzip | 20,479 bytes (cloud) | |
| Function time, 60 calls at 6 points | p50 3.6 ms, p95 12.0 ms | p50 2.9 ms, p95 5.1 ms |
| Nearest-first query | sorts every daycare inside the radius by computed distance | the GiST index returns them in distance order (`<->`) and stops at 150 |

Street, ZIP, county, capacity and geocode source are no longer in the list response; the place page gets them from `daycare_record`. pgTAP checks the 13 keys, the 150 cap, nearest-first order, the radius, the filters, and that no row carries a street, ZIP or county.

## Plans (inner query, the same machine, a busy moment)

Before: bitmap scan of the radius, then a sort of all 239 rows by distance.

```
Limit (actual time=63.988..64.007 rows=200 loops=1)
  ->  Sort (actual time=63.986..63.995 rows=200 loops=1)
        Sort Key: (st_distance(d.geom, '<Frisco point>'::geography, true))
        Sort Method: quicksort  Memory: 34kB
        ->  Bitmap Heap Scan on daycares d (actual time=56.589..63.837 rows=239 loops=1)
              Heap Blocks: exact=323
              ->  Bitmap Index Scan on daycares_geom_gix (actual time=2.182..2.182 rows=368 loops=1)
                    Index Cond: ((geom IS NOT NULL) AND (geom && _st_expand('<Frisco point>'::geography, '10000'::double precision)))
Execution Time: 64.786 ms
```

After: one index scan in distance order, no sort.

```
Limit (actual time=0.102..0.946 rows=150 loops=1)
  ->  Index Scan using daycares_geom_gix on daycares d (actual time=0.101..0.935 rows=150 loops=1)
        Index Cond: ((geom IS NOT NULL) AND (geom && _st_expand('<Frisco point>'::geography, '10000'::double precision)))
        Order By: (geom <-> '<Frisco point>'::geography)
Execution Time: 1.021 ms
```

On a quiet machine the before plan took 25 ms and the after plan 0.9 ms.
