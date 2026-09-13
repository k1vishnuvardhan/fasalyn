import {Link} from 'react-router-dom'
import {MapPinned,ScanLine,ShieldCheck,Sprout} from 'lucide-react'
import {PageTitle} from '../components/Shared'

export default function Home() {
  return <><PageTitle eyebrow="FASALYN" title="How do you want to monitor your crop?"/>
    <p className="title-subtitle">Choose the simple crop scanner or map your farm for plot-level monitoring.</p>
    <section className="mode-home">
      <Link className="card mode-card" to="/scanner"><ScanLine/><div><b>Quick Detection</b><span>Upload or take a crop image. No farm boundary required.</span></div></Link>
      <Link className="card mode-card" to="/farm"><MapPinned/><div><b>Map My Farm</b><span>Draw your actual farm boundary on a satellite map and create custom plots.</span></div></Link>
      <Link className="card mode-card" to="/setup"><Sprout/><div><b>Create Farm Account</b><span>Register, save farm data, and connect observations to real plots.</span></div></Link>
      <Link className="card mode-card" to="/officer"><ShieldCheck/><div><b>Officer Desk</b><span>Review mapped farms, scan cases, high-risk plots, and hotspot availability.</span></div></Link>
    </section>
  </>
}
