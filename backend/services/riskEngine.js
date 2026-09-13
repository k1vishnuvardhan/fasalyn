// All weights are intentionally visible/configurable for SIH demonstration.
export const weights = { trapPressure:.38, humidity:.16, wind:.12, cropStage:.14, neighboringCases:.20 }
export function assessRisk({trapCount=0, humidity=67, windSpeed=12, cropStage='flowering', nearbyRisk=0}) {
 const trap=Math.min(trapCount/20,1)*100
 const humid=Math.max(0,Math.min(100,(humidity-40)*2.5))
 const wind=Math.max(0,100-windSpeed*4)
 const stage=cropStage.toLowerCase()==='flowering'?82:55
 const score=Math.round(trap*weights.trapPressure+humid*weights.humidity+wind*weights.wind+stage*weights.cropStage+nearbyRisk*weights.neighboringCases)
 return { score, level:score>=75?'High':score>=50?'Elevated':score>=30?'Moderate':'Stable', factors:{trap,humid,wind,stage,nearbyRisk}, weights }
}
export function propagate(source, horizonHours=24) {
 const rate=Math.min(.65, .35+(horizonHours/120)); const reductions={P4:.82,P6:.9,P8:.67}
 return Object.entries(reductions).map(([plot,proximity])=>({plot,score:Math.round(source*rate*proximity),horizonHours}))
}
