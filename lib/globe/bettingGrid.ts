// lib/globe/bettingGrid.ts
// Legacy multiplier betting grid (old non-game play mode): 162 cells drawn as
// faint rectangles with an "Nx" label, hover highlight + tooltip, click to
// select a cell (opens BetModal via the game store).

import * as Cesium from 'cesium';
import { useGameStore } from '@/store/gameStore';
import { buildInitialCells, cellCenter, cellColor, regionName } from '@/lib/grid';
import { GRID_GRAY } from './config';
import type { GridCell } from '@/types';

export function attachBettingGrid({
  viewer,
  scene,
  tooltipEl,
}: {
  viewer: Cesium.Viewer;
  scene: Cesium.Scene;
  tooltipEl: HTMLDivElement | null;
}): () => void {
  const cellEntities = new Map<string, Cesium.Entity>();
  const cellBase = new Map<string, Cesium.Color>();

  const setHover = (cellId: string | null, on: boolean) => {
    if (!cellId) return;
    const ent = cellEntities.get(cellId);
    const base = cellBase.get(cellId);
    if (!ent || !ent.rectangle || !base) return;
    ent.rectangle.material = new Cesium.ColorMaterialProperty(base.withAlpha(on ? 0.16 : 0.0));
    ent.rectangle.outlineColor = new Cesium.ConstantProperty(GRID_GRAY.withAlpha(on ? 0.6 : 0.22));
  };

  const syncCells = (cells: Record<string, GridCell>) => {
    for (const cell of Object.values(cells)) {
      const center = cellCenter(cell.lonMin, cell.latMin);
      const { color } = cellColor(cell.multiplier);
      const base = Cesium.Color.fromCssColorString(color);
      cellBase.set(cell.id, base);
      let ent = cellEntities.get(cell.id);
      if (!ent) {
        ent = viewer.entities.add({
          id: `cell_${cell.id}`,
          position: Cesium.Cartesian3.fromDegrees(center.lon, center.lat),
          rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(
              cell.lonMin,
              cell.latMin,
              cell.lonMin + 20,
              cell.latMin + 20,
            ),
            material: new Cesium.ColorMaterialProperty(base.withAlpha(0.0)),
            height: 0,
            outline: true,
            outlineColor: GRID_GRAY.withAlpha(0.22),
          },
          label: {
            text: `${cell.multiplier.toFixed(1)}x`,
            font: '600 13px sans-serif',
            fillColor: GRID_GRAY.withAlpha(0.55),
            showBackground: false,
            disableDepthTestDistance: 0,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
          },
        });
        cellEntities.set(cell.id, ent);
      } else if (ent.label) {
        ent.label.text = new Cesium.ConstantProperty(`${cell.multiplier.toFixed(1)}x`);
      }
    }
  };

  if (Object.keys(useGameStore.getState().cells).length === 0) {
    useGameStore.getState().setCells(buildInitialCells());
  }
  syncCells(useGameStore.getState().cells);

  let prevCells = useGameStore.getState().cells;
  const unsubCells = useGameStore.subscribe((state) => {
    if (state.cells !== prevCells) {
      prevCells = state.cells;
      syncCells(state.cells);
    }
  });

  const pickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  let hoveredId: string | null = null;

  const pickedCellId = (pos: Cesium.Cartesian2): string | null => {
    const picked = scene.pick(pos) as { id?: { id?: unknown } } | undefined;
    const id = picked?.id?.id;
    return typeof id === 'string' && id.startsWith('cell_') ? id.slice(5) : null;
  };

  pickHandler.setInputAction((m: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
    const cellId = pickedCellId(m.endPosition);
    if (cellId !== hoveredId) {
      setHover(hoveredId, false);
      hoveredId = cellId;
      setHover(hoveredId, true);
      scene.canvas.style.cursor = cellId ? 'pointer' : 'default';
    }
    if (cellId && tooltipEl) {
      const cell = useGameStore.getState().cells[cellId];
      const c = cellCenter(cell.lonMin, cell.latMin);
      tooltipEl.style.display = 'block';
      tooltipEl.style.left = `${m.endPosition.x}px`;
      tooltipEl.style.top = `${m.endPosition.y}px`;
      tooltipEl.innerHTML =
        `<div style="font-weight:600">${regionName(c.lat, c.lon)}</div>` +
        `<div style="opacity:.7">${cell.multiplier.toFixed(1)}x multiplier</div>` +
        `<div style="opacity:.5">${cell.strikeCount24h} strikes / 24h · ${cell.activeBets} bets</div>`;
    } else if (tooltipEl) {
      tooltipEl.style.display = 'none';
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  pickHandler.setInputAction((c: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    const cellId = pickedCellId(c.position);
    if (cellId) useGameStore.getState().selectCell(cellId);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  return () => {
    pickHandler.destroy();
    unsubCells();
  };
}