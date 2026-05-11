/**
 * Resolve task atual do Bambu Cloud → URLs de preview (Story 4.7).
 *
 * Mantém cache por printer pra evitar fetch HTTP a cada mensagem MQTT.
 * Refetch dispara quando subtask_id muda (=novo print começou) ou após
 * TTL de fallback (caso missed mudança).
 */

import type { Logger } from './logger.js';

const API_BASE = 'https://api.bambulab.com';

const HTTP_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'bambu_network_agent/01.09.05.01',
  'X-BBL-Client-Name': 'OrcaSlicer',
  'X-BBL-Client-Type': 'slicer',
  'X-BBL-Client-Version': '01.09.05.51',
};

export interface TaskPreview {
  bambuModelId: string | null;
  plateIndex: number | null;
  coverUrl: string | null;
  topUrl: string | null;
  pickUrl: string | null;
}

interface TaskApiResponse {
  hits?: Array<{
    id?: number;
    instanceId?: number;
    modelId?: string;
    deviceId?: string;
    cover?: string;
    title?: string;
    plateIndex?: number;
    startTime?: string;
  }>;
}

interface TaskDetailPlate {
  index?: number;
  name?: string;
  thumbnail?: { url?: string };
  top_picture?: { url?: string };
  pick_picture?: { url?: string };
}

interface TaskDetailResponse {
  model_id?: string;
  context?: {
    plates?: TaskDetailPlate[];
  };
}

const EMPTY: TaskPreview = {
  bambuModelId: null,
  plateIndex: null,
  coverUrl: null,
  topUrl: null,
  pickUrl: null,
};

export class TaskResolver {
  // Cache: printerId → último resultado
  private cache = new Map<string, TaskPreview>();
  // Cache: deviceId → último task.id processado (pra detectar mudança)
  private lastTaskByDevice = new Map<string, number>();
  // Anti-stampede: deviceId em flight
  private inflight = new Set<string>();

  constructor(
    private readonly accessToken: string,
    private readonly logger: Logger,
  ) {}

  get(printerId: string): TaskPreview {
    return this.cache.get(printerId) ?? EMPTY;
  }

  /**
   * Tenta resolver a task atual pro device. Idempotente — se já temos
   * cache e o subtask hint não mudou, retorna o cache sem fetch.
   *
   * @param printerId UUID interno do PrintStudio
   * @param deviceId  serial Bambu (dev_id)
   * @param subtaskHint string opcional do MQTT — quando muda, força refresh
   */
  async refresh(printerId: string, deviceId: string, subtaskHint: string): Promise<void> {
    // Anti-stampede simples
    if (this.inflight.has(deviceId)) return;
    this.inflight.add(deviceId);
    try {
      // 1. Lista as últimas tasks e acha a do device
      const tasksRes = await fetch(`${API_BASE}/v1/user-service/my/tasks?limit=20`, {
        headers: { ...HTTP_HEADERS, Authorization: `Bearer ${this.accessToken}` },
      });
      if (!tasksRes.ok) {
        this.logger.warn({ status: tasksRes.status }, 'tasks fetch failed');
        return;
      }
      const tasksData = (await tasksRes.json()) as TaskApiResponse;
      const task = (tasksData.hits ?? []).find((t) => t.deviceId === deviceId);
      if (!task || !task.id) {
        this.logger.debug({ deviceId }, 'sem task pra esse device');
        return;
      }

      const lastSeen = this.lastTaskByDevice.get(deviceId);
      if (lastSeen === task.id) {
        // mesma task — nada a refazer
        return;
      }
      this.lastTaskByDevice.set(deviceId, task.id);

      // 2. Detalhes da task pra pegar top/pick (cover já vem do tasklist)
      const detailRes = await fetch(`${API_BASE}/v1/iot-service/api/user/task/${task.id}`, {
        headers: { ...HTTP_HEADERS, Authorization: `Bearer ${this.accessToken}` },
      });
      let topUrl: string | null = null;
      let pickUrl: string | null = null;
      let modelId: string | null = task.modelId ?? null;
      if (detailRes.ok) {
        const detail = (await detailRes.json()) as TaskDetailResponse;
        modelId = modelId ?? detail.model_id ?? null;
        // Um .3mf pode ter múltiplos plates. O tasklist diz qual está
        // sendo impresso via `plateIndex` (1-based). Filtra detail.plates
        // por index; fallback pro primeiro plate se não bater (raro).
        const wantPlateIndex = task.plateIndex ?? 1;
        const plates = detail.context?.plates ?? [];
        const plate = plates.find((p) => p.index === wantPlateIndex) ?? plates[0];
        topUrl = plate?.top_picture?.url ?? null;
        pickUrl = plate?.pick_picture?.url ?? null;
      } else {
        this.logger.warn({ status: detailRes.status, taskId: task.id }, 'task detail fetch failed');
      }

      const preview: TaskPreview = {
        bambuModelId: modelId,
        plateIndex: task.plateIndex ?? null,
        coverUrl: task.cover ?? null,
        topUrl,
        pickUrl,
      };
      this.cache.set(printerId, preview);
      this.logger.info(
        {
          printerId,
          deviceId,
          taskId: task.id,
          modelId,
          title: task.title,
          hasCover: !!preview.coverUrl,
          hasPick: !!preview.pickUrl,
        },
        'task preview resolved',
      );

      // Marca subtaskHint pra detectar mudança no MQTT
      void subtaskHint;
    } catch (err) {
      this.logger.warn({ err: (err as Error).message, deviceId }, 'task resolver error');
    } finally {
      this.inflight.delete(deviceId);
    }
  }
}
