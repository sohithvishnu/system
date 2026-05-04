import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONT, FONT_FAMILY, RADIUS, SPACE } from '../../constants/theme';
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
          <Feather name="folder" size={22} color={COLORS.accent} />
        </View>

        {/* Folder Content */}
        <View style={styles.folderContent}>
          <Text style={styles.projectName}>
            {projectName}
          </Text>
          <Text style={styles.activeCounter}>
            {formattedCount} active
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
            <Feather name="x" size={FONT.lg} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.detailsList} showsVerticalScrollIndicator={false}>
          {activeTasks.length === 0 ? (
            <Text style={styles.emptyText}>$ no active tasks</Text>
          ) : (
            activeTasks.map(task => (
              <View key={task.id} style={styles.detailsTaskCard}>
                <Text style={styles.detailsTaskTitle}>{task.title}</Text>
                <View style={styles.detailsTaskMetaRow}>
                  <Text style={styles.detailsTaskMeta}>
                    {(task.entity_type || 'to_do').toLowerCase().replace('_', ' ')} · {task.priority?.toLowerCase() || 'medium'}
                  </Text>
                  <Text style={styles.detailsTaskTime}>
                    {task.dueDate || 'no date'}
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
          <Text style={styles.headerTitle}>projects</Text>
          <Text style={styles.headerSubtitle}>~/projects</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>loading...</Text>
        </View>
      ) : projectEntries.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>$ no projects found</Text>
          <Text style={styles.emptySubtext}>assign a task to a project to get started.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.projectsGrid}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.accent} />}
          contentContainerStyle={{ paddingVertical: SPACE.lg, paddingHorizontal: SPACE.lg, gap: SPACE.sm }}
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
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg,
    borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg,
  },
  headerTitle: { fontSize: FONT.xxl, fontWeight: '500', color: COLORS.textPrimary, fontFamily: FONT_FAMILY.sans },
  headerSubtitle: { fontSize: FONT.md, color: COLORS.textMuted, fontFamily: FONT_FAMILY.mono, marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACE.xl },
  loadingText: { color: COLORS.textMuted, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono },
  emptyTitle: { color: COLORS.textMuted, fontSize: FONT.base, fontFamily: FONT_FAMILY.mono, marginBottom: SPACE.xs },
  emptySubtext: { color: COLORS.textGhost, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono, textAlign: 'center' },

  projectsGrid: { flex: 1 },
  projectFolder: {
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.md,
    padding: SPACE.md,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
  },
  folderIconContainer: {
    width: SPACE.xl + SPACE.xl,
    height: SPACE.xl + SPACE.xl,
    backgroundColor: COLORS.bg,
    borderWidth: 1, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.sm,
    justifyContent: 'center', alignItems: 'center',
  },
  folderContent: { flex: 1 },
  projectName: {
    color: COLORS.textPrimary, fontWeight: '500',
    fontSize: FONT.md, marginBottom: SPACE.xs,
    fontFamily: FONT_FAMILY.mono,
  },
  activeCounter: {
    color: COLORS.accent, fontSize: FONT.xs,
    fontFamily: FONT_FAMILY.mono,
  },

  modal: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: SPACE.lg,
  },
  modalContent: {
    width: '100%', maxWidth: 480, maxHeight: '80%',
    backgroundColor: COLORS.bg,
    borderWidth: 1, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.lg,
  },
  detailsModal: { flex: 1, backgroundColor: COLORS.bg },
  detailsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACE.md, paddingHorizontal: SPACE.md,
    borderBottomWidth: 1, borderColor: COLORS.border,
  },
  detailsTitle: {
    color: COLORS.textPrimary, fontWeight: '500',
    fontSize: FONT.md, fontFamily: FONT_FAMILY.mono,
  },
  detailsList: { flex: 1 },
  emptyText: {
    color: COLORS.textGhost, fontSize: FONT.sm,
    textAlign: 'center', paddingVertical: SPACE.xl,
    fontFamily: FONT_FAMILY.mono,
  },
  detailsTaskCard: {
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    borderBottomWidth: 1, borderColor: COLORS.border,
  },
  detailsTaskTitle: {
    color: COLORS.textPrimary, fontWeight: '500',
    fontSize: FONT.md, marginBottom: SPACE.xs,
    fontFamily: FONT_FAMILY.sans,
  },
  detailsTaskMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailsTaskMeta: {
    color: COLORS.textMuted, fontSize: FONT.xs,
    fontFamily: FONT_FAMILY.mono,
  },
  detailsTaskTime: {
    color: COLORS.textGhost, fontSize: FONT.xs,
    fontFamily: FONT_FAMILY.mono,
  },
});
