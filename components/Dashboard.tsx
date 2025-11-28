
import React, { useState } from 'react';
import { ProjectPlan, PhaseType } from '../types';
import { Plus, Trash2, Copy, Calendar } from 'lucide-react';

interface DashboardProps {
  plans: ProjectPlan[];
  onCreate: (plan: ProjectPlan) => void;
  onSelect: (plan: ProjectPlan) => void;
  onDelete: (id: string) => void;
  onDuplicate: (plan: ProjectPlan) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ plans, onCreate, onSelect, onDelete, onDuplicate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDesc, setNewPlanDesc] = useState('');

  const handleCreate = async () => {
    if (!newPlanName) return;

    const newPlan: ProjectPlan = {
      id: crypto.randomUUID(),
      name: newPlanName,
      description: newPlanDesc,
      createdAt: new Date().toISOString(),
      phases: [],
      holidays: [],
      subProjects: []
    };
    onCreate(newPlan);
    setNewPlanName('');
    setNewPlanDesc('');
    setIsModalOpen(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-10">
        <div>
           <h1 className="text-4xl font-bold text-slate-800 tracking-tight">Mes Retroplannings</h1>
           <p className="text-slate-500 mt-2">Manage your project timelines effectively.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all transform hover:scale-105"
        >
          <Plus size={20} />
          <span>New Project</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div 
            key={plan.id} 
            className="group bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
            onClick={() => onSelect(plan)}
          >
            <div className="h-2 w-full bg-gradient-to-r from-indigo-500 to-purple-500" />
            <div className="p-6 flex-1">
              <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">{plan.name}</h3>
              <p className="text-slate-500 text-sm line-clamp-2 mb-4 h-10">{plan.description || "No description provided."}</p>
              
              <div className="flex items-center gap-4 text-xs text-slate-400 mt-auto">
                <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    {new Date(plan.createdAt).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    {plan.phases.length} Phases
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => { e.stopPropagation(); onDuplicate(plan); }}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Duplicate"
              >
                <Copy size={18} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(plan.id); }}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}

        {plans.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-400 bg-white border border-dashed border-slate-300 rounded-2xl">
                <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                <p>No projects yet. Create your first retroplanning!</p>
            </div>
        )}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">Create New Project</h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="e.g., Website Redesign Q1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                <textarea 
                  value={newPlanDesc}
                  onChange={(e) => setNewPlanDesc(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                  placeholder="Brief overview of the project scope..."
                />
              </div>

            </div>

            <div className="p-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreate}
                disabled={!newPlanName}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium shadow-md transition-all flex items-center gap-2"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
