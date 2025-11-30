/**
 * 功能开关配置文件
 * 用于控制新功能的启用/禁用，确保在出问题时可以快速回退到稳定版本
 * 
 * 使用方法：
 * - 将所有新功能开关设置为 false，使用旧版稳定逻辑
 * - 逐步开启新功能进行测试
 */

export const featureFlags = {
  // 新的动态寻路系统（A*算法）
  // 默认开启，确保敌人遵循网格路径并避免穿墙
  newPathfinding: true,

  // 新的塔放置规则（"不要堵路"的寻路检查）
  // 当为false时，使用最初简单的塔放置规则（只要不是障碍/base/出入口就允许放置）
  newTowerBlockCheck: false,

  // 多种小怪类型（sprinter/devourer/smart/healer等）
  // 当为false时，只生成原来的普通小怪
  multiEnemyTypes: false,

  // 调试模式中的路径可视化、高亮地图等调试功能
  // 当为false时，不渲染任何调试线条和额外图层
  debugOverlay: false,
};

export default featureFlags;

