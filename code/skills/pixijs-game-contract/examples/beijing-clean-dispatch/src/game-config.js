export default {
  "id": "beijing-air-data-clean-dispatch",
  "title": "北京空气质量数据清洁调度",
  "description": "移动数据巡检员，回收字段校验工单并避开口径漂移。",
  "durationSeconds": 45,
  "scorePerTicket": 10,
  "hazardPenalty": 5,
  "speed": 220,
  "controls": [
    "方向键或 WASD 移动",
    "R 键或按钮重新开始"
  ],
  "healthBoundary": "这是数据质量教学游戏，不表示实时空气质量，不提供健康建议。",
  "playerStart": {
    "x": 120,
    "y": 160
  },
  "tickets": [
    {
      "label": "缺失字段工单",
      "x": 260,
      "y": 160
    },
    {
      "label": "时间戳工单",
      "x": 560,
      "y": 360
    },
    {
      "label": "站点一致性工单",
      "x": 790,
      "y": 140
    }
  ],
  "hazards": [
    {
      "label": "口径漂移",
      "x": 430,
      "y": 250
    },
    {
      "label": "未经核验的推断",
      "x": 730,
      "y": 410
    }
  ]
};
