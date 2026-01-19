import React, { useState, useEffect } from 'react'
import { dashboardAPI } from '../utils/api'
import { 
  Shield, Package, Zap, Users, ArrowUpCircle, 
  ArrowDownCircle, AlertTriangle, Activity, 
  ChevronRight, Landmark, Database, 
  Hash, Calendar, User, ClipboardList
} from 'lucide-react'
import Logo from '../components/Logo'

const Dashboard = () => {
  // --- Live Data Integration ---
  const [stats, setStats] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTerminalData = async () => {
      try {
        const [statsRes, transRes] = await Promise.all([
          dashboardAPI.getStats(),
          dashboardAPI.getRecentTransactions()
        ])
        setStats(statsRes.data)
        setTransactions(transRes.data)
      } catch (error) {
        console.error("Terminal Sync Error:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchTerminalData()
  }, [])

  if (loading || !stats) return (
    <div className="h-screen bg-[#F1F5F9] flex items-center justify-center font-black text-slate-400 text-[10px] tracking-[0.5em] animate-pulse">
      SYNCING TERMINAL...
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 lg:p-8 space-y-6 font-sans">
      
      {/* 1. TOP COMMAND BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#F1F5F9] p-5 border border-gray-300">
        <div className="flex items-center gap-4">
          <Logo/>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Armoury Control Terminal</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">KSRP Unit-01 • Sector HQ</p>
          </div>
        </div>
        
        <div className="mt-4 md:mt-0 flex gap-2">
          <div className="bg-white border border-gray-300 px-4 py-1 shadow-sm">
            <p className="text-[9px] font-black text-gray-400 uppercase">System Status</p>
            <p className={`text-xs font-black uppercase italic ${stats.shortages > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.shortages > 0 ? 'Shortage Detected' : 'Operational'}
            </p>
          </div>
          <div className="bg-white border border-gray-300 px-4 py-1 shadow-sm">
            <p className="text-[9px] font-black text-gray-400 uppercase">Batch Ref</p>
            <p className="text-xs font-black text-slate-800 uppercase tracking-tighter">JAN-2026-017</p>
          </div>
        </div>
      </div>

      {/* 2. CORE DATA GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* ARMS BLOCK */}
        <div className="bg-white border border-gray-200 p-5 group hover:bg-[#fffdf0] hover:border-yellow-500 transition-all shadow-sm">
          <div className="flex justify-between mb-4 items-start">
            <Shield className={`h-5 w-5 ${stats.availableArms === 0 ? 'text-red-600' : 'text-slate-400'}`} />
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Arms Control</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-black ${stats.availableArms === 0 ? 'text-red-600' : 'text-slate-900'}`}>{stats.availableArms}</span>
            <span className="text-sm font-bold text-gray-400">/ {stats.totalArms} Units</span>
          </div>
          <div className="w-full bg-gray-200 h-1 mt-3">
            <div className="h-full bg-slate-800" style={{ width: `${(stats.availableArms/stats.totalArms)*100}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-2 text-[10px] font-black uppercase text-gray-500">
             <span>Issued: {stats.issuedArms}</span>
             <span className="text-right">Maint: {stats.maintenanceArms}</span>
          </div>
        </div>

        {/* AMMUNITION BLOCK */}
        <div className="bg-white border border-gray-200 p-5 group hover:bg-[#fffdf0] hover:border-yellow-500 transition-all shadow-sm">
          <div className="flex justify-between mb-4 items-start">
            <Package className="h-5 w-5 text-slate-800" />
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Ammunition</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{stats.availableAmmunition}</span>
            <span className="text-sm font-bold text-gray-400">/ {stats.totalAmmunition} Rds</span>
          </div>
          <div className="w-full bg-gray-200 h-1 mt-3">
            <div className="h-full bg-slate-600" style={{ width: `${(stats.availableAmmunition/stats.totalAmmunition)*100}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-2 text-[10px] font-black uppercase text-gray-500">
             <span>Types: {stats.ammunitionTypes}</span>
             <span className="text-right italic text-red-400 tracking-tighter">Issued: {stats.issuedAmmunition}</span>
          </div>
        </div>

        {/* PERSONNEL BLOCK */}
        <div className="bg-white border border-gray-200 p-5 group hover:bg-[#fffdf0] hover:border-yellow-500 transition-all shadow-sm">
          <div className="flex justify-between mb-4 items-start">
            <Users className="h-5 w-5 text-slate-500" />
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Active Force</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{stats.activeOfficers}</span>
            <span className="text-sm font-bold text-gray-400">/ {stats.totalOfficers} Pers</span>
          </div>
          <div className="w-full bg-gray-200 h-1 mt-3">
            <div className="h-full bg-slate-400" style={{ width: `${(stats.activeOfficers/stats.totalOfficers)*100}%` }} />
          </div>
          <div className="mt-4 text-[10px] font-black uppercase text-gray-500 italic">
             {stats.inactiveOfficers} Officers Off-Duty
          </div>
        </div>

        {/* MUNITIONS BLOCK */}
        <div className="bg-white border border-gray-200 p-5 group hover:bg-[#fffdf0] hover:border-yellow-500 transition-all shadow-sm">
          <div className="flex justify-between mb-4 items-start">
            <Zap className="h-5 w-5 text-yellow-600" />
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Munitions Vault</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-300">{stats.availableMunitions}</span>
            <span className="text-sm font-bold text-gray-300">/ {stats.totalMunitions} Units</span>
          </div>
          <div className="w-full bg-gray-200 h-1 mt-3">
            <div className="h-full bg-yellow-400" style={{ width: `0%` }} />
          </div>
          <div className="mt-4 text-[10px] font-black uppercase text-gray-400 italic">
             Vault Storage Depleted
          </div>
        </div>

      </div>

      {/* 3. CENTER WORKFLOW SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEDGER TABLE */}
        <div className="lg:col-span-2 bg-white border border-gray-300 shadow-sm">
          <div className="p-4 bg-[#F1F5F9] border-b border-gray-300 flex justify-between items-center">
            <h2 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 italic">
              <Activity className="h-4 w-4" /> Operational Ledger
            </h2>
            <div className="flex gap-4">
               <div className="text-right">
                  <p className="text-[8px] font-black text-gray-400 uppercase leading-none mb-1">Today Issues</p>
                  <p className="text-xs font-black text-red-600">{stats.todayIssues}</p>
               </div>
               <div className="text-right border-l border-gray-300 pl-4">
                  <p className="text-[8px] font-black text-gray-400 uppercase leading-none mb-1">Today Returns</p>
                  <p className="text-xs font-black text-green-600">{stats.todayReturns}</p>
               </div>
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
            <table className="w-full text-left min-w-[600px]">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                <tr className="bg-[#F8FAFC] text-[9px] font-black text-gray-400 uppercase tracking-tighter border-b border-gray-200">
                  <th className="px-6 py-3"><Hash className="h-3 w-3 inline mr-1 opacity-50"/> ID</th>
                  <th className="px-6 py-3"><User className="h-3 w-3 inline mr-1 opacity-50"/> Personnel / Asset</th>
                  <th className="px-6 py-3">Vector</th>
                  <th className="px-6 py-3 text-right">System_Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 italic">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-6 py-4 text-[10px] font-mono font-black text-gray-400">{tx.id}</td>
                    <td className="px-6 py-4">
                       <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{tx.officerName}</p>
                       <p className="text-[9px] text-gray-400 font-bold uppercase">{tx.officerRank}</p>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`text-[9px] font-black px-2 py-1 border uppercase tracking-widest ${
                         tx.type === 'issue' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'
                       }`}>
                         {tx.type} • {tx.itemsCount} QTY
                       </span>
                    </td>
                    <td className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase text-right">
                       {new Date(tx.date).toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT RAIL: ALERTS & ACTIONS */}
        <div className="space-y-4">
          <div className="bg-[#fffdf0] border border-yellow-400 p-5 shadow-sm">
            <h3 className="text-[10px] font-black text-yellow-800 uppercase tracking-widest mb-4 flex items-center gap-2 italic underline underline-offset-4">
               <AlertTriangle className="h-3 w-3" /> System Criticals
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-white p-3 border border-gray-300 group transition-all hover:border-slate-800 cursor-help">
                 <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter group-hover:text-slate-800">Pending Pool</span>
                 <span className="text-sm font-black text-slate-900 tabular-nums">{stats.pendingReturns}</span>
              </div>
              <div className="flex justify-between items-center bg-white p-3 border border-gray-300">
                 <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Inventory Gaps</span>
                 <span className={`text-sm font-black tabular-nums ${stats.shortages > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                    {stats.shortages === 0 ? 'NOMINAL' : stats.shortages}
                 </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
             <button className="flex items-center justify-between p-4 bg-slate-900 text-white hover:bg-slate-800 transition-all border-l-4 border-red-600 shadow-lg group">
                <div className="flex items-center gap-3">
                   <ArrowUpCircle className="h-5 w-5 text-red-400 group-hover:scale-110 transition-transform" />
                   <span className="text-xs font-black uppercase tracking-widest">Execute Issue</span>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-white" />
             </button>
             <button className="flex items-center justify-between p-4 bg-white border border-gray-300 text-slate-800 hover:border-black transition-all border-l-4 border-gray-400 shadow-sm group">
                <div className="flex items-center gap-3">
                   <ArrowDownCircle className="h-5 w-5 text-slate-400 group-hover:scale-110 transition-transform" />
                   <span className="text-xs font-black uppercase tracking-widest text-gray-600">Execute Return</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-slate-900" />
             </button>
             <button className="flex items-center justify-between p-4 bg-white border border-gray-200 text-slate-500 hover:bg-gray-50 transition-all shadow-sm group">
                <div className="flex items-center gap-3">
                   <ClipboardList className="h-5 w-5 text-slate-300 group-hover:text-slate-600" />
                   <span className="text-xs font-black uppercase tracking-widest">Master Audit</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-200 group-hover:text-slate-400" />
             </button>
          </div>
        </div>

      </div>

      {/* 4. FOOTER META */}
      <div className="flex flex-col sm:flex-row justify-between items-center border-t border-gray-200 pt-4 px-2 gap-4">
         <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic flex items-center gap-2">
            <Database className="h-3 w-3" /> Armoury_Kernel_v4.0.1_STABLE
         </p>
         <div className="flex gap-6">
            <button className="text-[9px] font-black text-slate-400 hover:text-slate-800 uppercase underline decoration-gray-200 underline-offset-4 transition-colors">Stock Ledger</button>
            <button className="text-[9px] font-black text-slate-400 hover:text-slate-800 uppercase underline decoration-gray-200 underline-offset-4 transition-colors">Staff Directory</button>
         </div>
      </div>
    </div>
  )
}

export default Dashboard;