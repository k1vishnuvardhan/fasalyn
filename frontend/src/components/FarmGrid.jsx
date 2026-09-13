import { motion } from 'framer-motion'
import { Sprout } from 'lucide-react'
export default function FarmGrid({ plots, selected, onSelect }) {
 return <div className="farm-grid">{plots.map(([id,status,score], i) => <motion.button layout key={id} onClick={()=>onSelect(id)} className={`plot ${status.toLowerCase()} ${selected===id?'selected':''}`} whileHover={{y:-3}}>
   <span className="plot-id">{id}</span><Sprout size={18}/><b>{score}</b><small>{status}</small>{status==='High'&&<i className="pulse"/>}
 </motion.button>)}</div>
}
