import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { 
  Search, ArrowDownCircle, Shield, Package, Zap, User, 
  Fingerprint, Upload, X, AlertTriangle, CheckCircle2, 
  Loader2, History, FileText, Trash2
} from 'lucide-react'
import { useFingerprint } from '../contexts/FingerprintContext'
import { officersAPI, transactionsAPI } from '../utils/api'

const ReturnItems = () => {
  const { captureFinger, verifyFinger, scannerStatus, isScanning } = useFingerprint()
  
  // Data States
  const [officers, setOfficers] = useState([])
  const [selectedOfficer, setSelectedOfficer] = useState(null)
  const [issuedItems, setIssuedItems] = useState([])
  
  // Return Tracking States
  const [selectedReturns, setSelectedReturns] = useState({})
  const [returnQuantities, setReturnQuantities] = useState({})
  const [emptyCases, setEmptyCases] = useState({})
  
  // Input/UI States
  const [kgidInput, setKgidInput] = useState('')
  const [documents, setDocuments] = useState([])
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(false)
  const [showKGIDModal, setShowKGIDModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  useEffect(() => {
    fetchOfficers()
  }, [])

  const fetchOfficers = async () => {
    try {
      const res = await officersAPI.getAll()
      setOfficers(res.data.data)
    } catch (error) {
      toast.error('Failed to fetch officer directory')
    }
  }

  const fetchIssuedItems = async (officerId) => {
    setLoading(true)
    try {
      const response = await transactionsAPI.getByOfficer(officerId)
      const transactions = response.data.data || []
      const issued = []
      
      transactions.forEach(transaction => {
        if (transaction.transactionType === 'issue') {
          // Process Weapons
          transaction.issuedItems.armoury?.forEach(arm => {
            if (!arm.returnTimestamp) {
              issued.push({ ...arm, type: 'arm', transactionId: transaction._id })
            }
          })
          // Process Ammunition with calculation for partial returns
          transaction.issuedItems.ammunition?.forEach(ammo => {
            const totalReturned = transactions
              .filter(t => t.transactionType === 'return')
              .reduce((sum, t) => {
                const returnedAmmo = t.issuedItems.ammunition?.find(a => a._id === ammo._id)
                return sum + (returnedAmmo?.returnedCount || 0)
              }, 0)
            const remaining = ammo.count - totalReturned
            if (remaining > 0) {
              issued.push({ ...ammo, type: 'ammunition', remainingCount: remaining, originalCount: ammo.count, transactionId: transaction._id })
            }
          })
          // Process Munition
          transaction.issuedItems.munition?.forEach(mun => {
            const totalReturned = transactions
              .filter(t => t.transactionType === 'return')
              .reduce((sum, t) => {
                const returnedMun = t.issuedItems.munition?.find(m => m._id === mun._id)
                return sum + (returnedMun?.returnedCount || 0)
              }, 0)
            const remaining = mun.count - totalReturned
            if (remaining > 0) {
              issued.push({ ...mun, type: 'munition', remainingCount: remaining, originalCount: mun.count, transactionId: transaction._id })
            }
          })
        }
      })
      setIssuedItems(issued)
    } catch (error) {
      toast.error('Failed to fetch equipment log')
    } finally {
      setLoading(false)
    }
  }

  const handleKGIDSubmit = async () => {
    const officer = officers.find(o => o.kgidNo === kgidInput.trim().toUpperCase())
    if (!officer) return toast.error('Officer not found')

    try {
      const result = await captureFinger()
      if (result.success) {
        const verifyResult = await verifyFinger(result.data.template, officer.fingerprintData)
        if (verifyResult.success && verifyResult.matched) {
          setSelectedOfficer(officer)
          setShowKGIDModal(false)
          setKgidInput('')
          await fetchIssuedItems(officer._id)
          toast.success(`Authenticated: ${officer.name}`)
        } else {
          toast.error('Biometric Mismatch')
        }
      }
    } catch (error) {
      toast.error('Scanner Error')
    }
  }

  const handleItemSelect = (item, selected) => {
    setSelectedReturns(prev => ({ ...prev, [item._id]: selected }))
    if (selected && (item.type !== 'arm')) {
      setReturnQuantities(prev => ({ ...prev, [item._id]: item.remainingCount }))
      setEmptyCases(prev => ({ ...prev, [item._id]: 0 }))
    }
  }

  const validateReturn = () => {
    const selectedIds = Object.keys(selectedReturns).filter(id => selectedReturns[id])
    if (selectedIds.length === 0) {
      toast.error('Select items to return')
      return false
    }

    let shortageDetected = false
    selectedIds.forEach(id => {
      const item = issuedItems.find(i => i._id === id)
      if (item && item.type !== 'arm') {
        const total = (returnQuantities[id] || 0) + (emptyCases[id] || 0)
        if (total < item.remainingCount) shortageDetected = true
      }
    })

    if (shortageDetected && documents.length === 0) {
      toast.error('Documents (FIR/Statement) required for shortage')
      return false
    }
    return true
  }

  const confirmReturn = async () => {
    setLoading(true)
    try {
      const formData = new FormData()
      const selectedIds = Object.keys(selectedReturns).filter(id => selectedReturns[id])
      
      const weaponIds = [], ammoIds = [], munIds = []
      const ammoCounts = {}, munCounts = {}, emptyCasesData = {}

      selectedIds.forEach(id => {
        const item = issuedItems.find(i => i._id === id)
        if (item.type === 'arm') weaponIds.push(id)
        else if (item.type === 'ammunition') {
          ammoIds.push(id)
          ammoCounts[id] = returnQuantities[id] || 0
          emptyCasesData[id] = emptyCases[id] || 0
        } else {
          munIds.push(id)
          munCounts[id] = returnQuantities[id] || 0
          emptyCasesData[id] = emptyCases[id] || 0
        }
      })

      formData.append('officerId', selectedOfficer._id)
      formData.append('weaponIds', JSON.stringify(weaponIds))
      formData.append('ammunitionIds', JSON.stringify(ammoIds))
      formData.append('munitionIds', JSON.stringify(munIds))
      formData.append('ammunitionCounts', JSON.stringify(ammoCounts))
      formData.append('munitionCounts', JSON.stringify(munCounts))
      formData.append('emptyCases', JSON.stringify(emptyCasesData))
      formData.append('remarks', remarks)
      documents.forEach(doc => formData.append('documents', doc))

      await axios.post('/api/transactions/return', formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${localStorage.getItem('token')}` }
      })

      toast.success('DEPOSIT SUCCESSFUL')
      resetForm()
      setShowConfirmModal(false)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Return failed')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setSelectedOfficer(null); setIssuedItems([]); setSelectedReturns({});
    setReturnQuantities({}); setEmptyCases({}); setDocuments([]);
    setRemarks(''); setKgidInput('');
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center mb-8 border-b-2 border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic text-slate-900">Inbound Equipment <span className="text-red-600">Return</span></h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Armoury Management System // Secure Deposit</p>
        </div>
        <button onClick={resetForm} className="flex items-center gap-2 px-6 py-3 bg-slate-200 text-slate-700 text-[10px] font-black uppercase hover:bg-slate-300 transition-all">
          <Trash2 size={14} /> Reset Session
        </button>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* LEFT COLUMN: AUTH & DOCS */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* OFFICER PROFILE */}
          <div className="bg-white border-2 border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase mb-6 flex items-center gap-2">
              <User size={16} className="text-red-600" /> Identity Verification
            </h3>
            {!selectedOfficer ? (
              <button onClick={() => setShowKGIDModal(true)} className="w-full py-12 border-2 border-dashed border-slate-200 flex flex-col items-center group hover:border-red-500 transition-all">
                <Fingerprint size={40} className="text-slate-300 group-hover:text-red-500 mb-2" />
                <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-red-600">Scan Fingerprint to Begin</span>
              </button>
            ) : (
              <div className="flex items-center gap-4 bg-slate-50 p-4 border border-slate-200">
                <div className="w-16 h-16 bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
                  <img src={`/api/uploads/${selectedOfficer.profilePicture}`} alt="" className="w-full h-full object-cover" onError={(e) => e.target.src = 'https://via.placeholder.com/64'} />
                </div>
                <div>
                  <p className="text-sm font-black uppercase">{selectedOfficer.name}</p>
                  <p className="text-[10px] font-bold text-red-600 uppercase italic">{selectedOfficer.rank} // {selectedOfficer.kgidNo}</p>
                </div>
              </div>
            )}
          </div>

          {/* DOCUMENTS */}
          <div className="bg-white border-2 border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase mb-4 flex items-center gap-2">
              <FileText size={16} className="text-red-600" /> Documentation
            </h3>
            <div className="space-y-4">
              <label className="block w-full cursor-pointer">
                <div className="border-2 border-dashed border-slate-200 p-4 text-center hover:bg-slate-50">
                  <Upload size={20} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-[10px] font-black uppercase text-slate-500">Upload Shortage Proof</p>
                  <input type="file" multiple onChange={(e) => setDocuments(Array.from(e.target.files))} className="hidden" />
                </div>
              </label>
              {documents.length > 0 && (
                <div className="bg-red-50 p-2 border border-red-100">
                   <p className="text-[9px] font-bold text-red-700 uppercase">{documents.length} Files Attached</p>
                </div>
              )}
              <textarea 
                value={remarks} 
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="ENTRY REMARKS..." 
                className="w-full bg-slate-50 border border-slate-200 p-3 text-[10px] font-bold uppercase focus:outline-none focus:border-red-500 min-h-[100px]"
              />
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: ISSUED ITEMS */}
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-white border-2 border-slate-200 p-8 shadow-sm min-h-[600px]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xs font-black uppercase flex items-center gap-2">
                <History size={16} className="text-red-600" /> Issued Equipment Log
              </h3>
              {selectedOfficer && (
                <span className="text-[10px] font-black bg-red-600 text-white px-3 py-1 uppercase italic tracking-widest">
                  Items Held: {issuedItems.length}
                </span>
              )}
            </div>

            {!selectedOfficer ? (
              <div className="flex flex-col items-center justify-center py-32 opacity-20">
                <Shield size={80} />
                <p className="text-xs font-black uppercase mt-4">Awaiting Authentication</p>
              </div>
            ) : (
              <div className="space-y-4">
                {issuedItems.map(item => (
                  <div key={item._id} className={`border-2 p-4 transition-all ${selectedReturns[item._id] ? 'border-red-500 bg-red-50/30' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <input 
                          type="checkbox" 
                          checked={selectedReturns[item._id] || false} 
                          onChange={(e) => handleItemSelect(item, e.target.checked)}
                          className="w-5 h-5 accent-red-600" 
                        />
                        <div>
                          <p className="text-xs font-black uppercase tracking-tight">
                            {item.type === 'arm' ? `${item.registerNumber} [${item.boreNo || 'N/A'}]` : item.name}
                          </p>
                          <div className="flex gap-2 items-center mt-1">
                            {item.type === 'arm' ? <Shield size={12} className="text-slate-400" /> : <Package size={12} className="text-amber-500" />}
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.type}</span>
                            {item.type !== 'arm' && (
                              <span className="text-[9px] font-black text-red-600">REMAINING: {item.remainingCount}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {selectedReturns[item._id] && item.type !== 'arm' && (
                        <div className="flex gap-4">
                          <div className="text-right">
                            <label className="block text-[8px] font-black text-slate-400 uppercase">Live Qty</label>
                            <input 
                              type="number" 
                              value={returnQuantities[item._id] || 0} 
                              onChange={(e) => setReturnQuantities({...returnQuantities, [item._id]: parseInt(e.target.value) || 0})}
                              className="w-16 bg-white border border-slate-300 text-center font-bold p-1 text-sm"
                            />
                          </div>
                          <div className="text-right">
                            <label className="block text-[8px] font-black text-slate-400 uppercase">Empty Cases</label>
                            <input 
                              type="number" 
                              value={emptyCases[item._id] || 0} 
                              onChange={(e) => setEmptyCases({...emptyCases, [item._id]: parseInt(e.target.value) || 0})}
                              className="w-16 bg-white border border-slate-300 text-center font-bold p-1 text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="mt-8">
            <button 
              onClick={() => validateReturn() && setShowConfirmModal(true)}
              disabled={!selectedOfficer || Object.values(selectedReturns).filter(Boolean).length === 0}
              className="w-full bg-slate-900 text-white py-6 text-xs font-black uppercase tracking-[0.4em] flex items-center justify-center gap-4 hover:bg-red-700 disabled:opacity-30 transition-all shadow-xl"
            >
              <ArrowDownCircle size={24} /> Authorize Deposit Log
            </button>
          </div>
        </div>
      </div>

      {/* KGID MODAL */}
      {showKGIDModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md shadow-2xl border-t-8 border-red-600">
            <div className="p-8">
              <h3 className="text-sm font-black uppercase mb-6 italic tracking-widest">Biometric Gateway</h3>
              <input 
                autoFocus 
                type="text" 
                value={kgidInput} 
                onChange={(e) => setKgidInput(e.target.value)} 
                placeholder="OFFICER KGID..." 
                className="w-full bg-slate-50 border-2 border-slate-200 p-4 font-black text-lg focus:border-red-500 outline-none mb-4"
              />
              <div className="flex flex-col items-center py-6 border-2 border-dashed border-slate-100 bg-slate-50 rounded mb-8">
                <Fingerprint size={48} className={isScanning ? 'text-red-500 animate-pulse' : 'text-slate-300'} />
                <p className="text-[10px] font-black uppercase text-slate-400 mt-4">Scanner Status: {scannerStatus}</p>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setShowKGIDModal(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 border border-slate-200">Abort</button>
                <button onClick={handleKGIDSubmit} className="flex-1 bg-slate-900 text-white py-4 text-[10px] font-black uppercase">Authenticate</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl shadow-2xl border-t-8 border-red-600">
            <div className="p-8">
              <div className="flex items-center gap-3 text-red-600 mb-6">
                <CheckCircle2 size={32} />
                <h3 className="text-xl font-black uppercase italic">Verify Return Manifest</h3>
              </div>
              <div className="space-y-3 mb-8 max-h-60 overflow-y-auto pr-4">
                {Object.keys(selectedReturns).filter(id => selectedReturns[id]).map(id => {
                  const item = issuedItems.find(i => i._id === id)
                  const total = (returnQuantities[id] || 0) + (emptyCases[id] || 0)
                  const shortage = item.type !== 'arm' ? item.remainingCount - total : 0
                  
                  return (
                    <div key={id} className="flex justify-between items-center bg-slate-50 p-3 border-l-4 border-slate-900">
                      <div>
                        <p className="text-[10px] font-black uppercase">{item.registerNumber || item.name}</p>
                        <p className="text-[9px] font-bold text-slate-400">{item.type}</p>
                      </div>
                      <div className="text-right">
                         <p className="text-xs font-black uppercase">Ret: {item.type === 'arm' ? '1' : total}</p>
                         {shortage > 0 && <p className="text-[9px] font-black text-amber-600">SHORTAGE: {shortage}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-4 pt-6 border-t border-slate-100">
                <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 border border-slate-200">Return to Editor</button>
                <button onClick={confirmReturn} className="flex-1 bg-red-600 text-white py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="animate-spin" /> : 'Finalize Deposit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReturnItems;