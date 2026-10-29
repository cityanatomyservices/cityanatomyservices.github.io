/* Provider contract for future pgRouting / road-network versions. The scheduler
   consumes minutes only. Map geometry and network loading never enter it.
   A later provider can implement leg(before, after, plan) with status:'ready',
   minutes, distanceMeters, geometry, mode, networkVersion and calculatedAt.
   This implementation contains NO inferred routes or journey times. */
window.PlanRouting = {
  leg(before, after, plan) {
    return { status: 'manual', minutes: after.schedule.bufferBefore ?? plan.bufferMinutes,
      distanceMeters: null, geometry: null, networkVersion: null };
  }
};
