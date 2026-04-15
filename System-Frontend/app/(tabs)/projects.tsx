import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';

type Ticket = { 
  id: string; 
  title: string; 
  dueDate: string; 
  priority: string; 
  status: string;
  entity_type?: string;
  project_id?: string;
};

type ProjectData = {
  [key: string]: Ticket[];
};

export default function ProjectsScreen() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchTickets = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setLoading(true);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/tickets?user_id=${user?.id}`, {
        signal: abortControllerRef.current.signal
      });
      const data = await response.json();
      if (data.success) {
        setTickets(data.tickets);
      } else {
        Alert.alert('Error', data.error || 'Failed to load tickets');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Failed to fetch tickets", error);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTickets();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTickets();
      return () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, [])
  );

  // Group tickets by project
  const getProjectGroups = (): ProjectData => {
    const grouped: ProjectData = {};
    
    tickets.forEach(ticket => {
      const projectKey = ticket.project_id || '[ UNASSIGNED ]';
      if (!grouped[projectKey]) {
        grouped[projectKey] = [];
      }
      grouped[projectKey].push(ticket);
    });
    
    return grouped;
  };

  // Get active (non-DONE) tasks count
  const getActiveTaskCount = (projectTasks: Ticket[]) => {
    return projectTasks.filter(t => t.status !== 'DONE').length;
  };

  const projects = getProjectGroups();
  const projectEntries = Object.entries(projects);

  const renderProjectFolder = (projectName: string, projectTasks: Ticket[], index: number) => {
    const activeCount = getActiveTaskCount(projectTasks);
    const formattedCount = String(activeCount).padStart(2, '0');

    return (
      <TouchableOpacity
        key={projectName}
        style={styles.projectFolder}
        onPress={() => {
          setSelectedProject(projectName);
          setShowProjectDetails(true);
        }}
      >
        {/* Folder Icon */}
        <View style={styles.folderIconContainer}>
          <Ionicons name="folder" size={40} color="#00FF66" />
        </View>

        {/* Folder Content */}
        <View style={styles.folderContent}>
          <Text style={styles.projectName}>
            > {projectName}
          </Text>
          <Text style={styles.activeCounter}>
            {formattedCount} ACTIVE_ENTITIES
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const openProjectDetails = (projectName: string) => {
    const projectTasks = projects[projectName];
    const activeTasks = projectTasks.filter(t => t.status !== 'DONE');

    return (
      <View style={styles.detailsModal}>
        <View style={styles.detailsHeader}>
          <Text style={styles.detailsTitle}>{projectName}</Text>
          <TouchableOpacity onPress={() => setShowProjectDetails(false)}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.detailsList} showsVerticalScrollIndicator={false}>
          {activeTasks.length === 0 ? (
            <Text style={styles.emptyText}>NO ACTIVE TASKS IN THIS PROJECT</Text>
          ) : (
            activeTasks.map(task => (
              <View key={task.id} style={styles.detailsTaskCard}>
                <Text style={styles.detailsTaskTitle}>{task.title.toUpperCase()}</Text>
                <View style={styles.detailsTaskMeta}>
                  <Text style={styles.detailsTaskMeta}>
                    {task.entity_type || 'TO_DO'} • {task.priority?.toUpperCase() || 'MEDIUM'}
                  </Text>
                  <Text style={styles.detailsTaskTime}>
                    {task.dueDate || 'NO DATE'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>PROJECT /</Text>
          <Text style={styles.headerHighlight}>HUB</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#00FF66', fontWeight: '900', letterSpacing: 2, fontSize: 14 }}>[ SYSTEM_LOADING... ]</Text>
        </View>
      ) : projectEntries.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '900', letterSpacing: 1, fontSize: 20, marginBottom: 16 }}>[ NO_PROJECTS_FOUND ]</Text>
          <Text style={{ color: '#666666', fontWeight: '900', letterSpacing: 1, fontSize: 12, textAlign: 'center' }}>CREATE A TASK AND ASSIGN IT TO A PROJECT TO BEGIN.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.projectsGrid}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00FF66" />}
          contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 16, gap: 12 }}
        >
          {projectEntries.map(([projectName, projectTasks], index) =>
            renderProjectFolder(projectName, projectTasks, index)
          )}
        </ScrollView>
      )}

      {/* Project Details Modal */}
      {showProjectDetails && selectedProject && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            {openProjectDetails(selectedProject)}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderColor: '#1a1a1a',
    backgroundColor: '#000000',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  headerHighlight: {
    fontSize: 28,
    fontWeight: '900',
    color: '#00FF66',
    letterSpacing: -1,
    marginTop: 4,
  },
  projectsGrid: {
    flex: 1,
  },
  projectFolder: {
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 0,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  folderIconContainer: {
    width: 60,
    height: 60,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#00FF66',
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderContent: {
    flex: 1,
  },
  projectName: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
    marginBottom: 8,
    fontFamily: 'Courier New',
  },
  activeCounter: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: 'Courier New',
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 0,
  },
  detailsModal: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderColor: '#1a1a1a',
  },
  detailsTitle: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
    fontFamily: 'Courier New',
  },
  detailsList: {
    flex: 1,
  },
  emptyText: {
    color: '#666666',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: 40,
    fontFamily: 'Courier New',
  },
  detailsTaskCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#1a1a1a',
  },
  detailsTaskTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  detailsTaskMeta: {
    color: '#888888',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
    fontFamily: 'Courier New',
  },
  detailsTaskTime: {
    color: '#666666',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
    fontFamily: 'Courier New',
  },
});
