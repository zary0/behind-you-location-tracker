import * as duckdb from '@duckdb/duckdb-wasm';

// Interface for location history record
export interface LocationHistoryRecord {
  id: string;
  latitude: number;
  longitude: number;
  description: string;
  timestamp: string;
  image_data?: string; // Base64 encoded image
  analysis_mode: 'basic' | 'function' | 'grounding' | 'image-search';
  confidence_score?: number;
  source: 'camera' | 'upload';
  weather_data?: any;
  nearby_places?: any[];
}

// Interface for location summary
export interface LocationSummary {
  id: string;
  latitude: number;
  longitude: number;
  description: string;
  timestamp: string;
  analysis_mode: string;
  source: string;
}

export class LocationHistoryDB {
  private db: duckdb.AsyncDuckDB | null = null;
  private connection: duckdb.AsyncDuckDBConnection | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private dbFileName = 'location_tracker.db';
  private useOPFS = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      console.log('Initializing DuckDB WASM for location tracking...');
      
      // Use JSDELIVR bundles for CDN-based loading
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
      
      // Select a bundle based on browser checks
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
      
      if (!bundle.mainWorker) {
        throw new Error('No worker bundle available');
      }
      
      // Create worker with error handling
      const worker_url = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
      );
      
      const worker = new Worker(worker_url);
      const logger = new duckdb.VoidLogger();
      
      // Initialize DuckDB with error handling
      this.db = new duckdb.AsyncDuckDB(logger, worker);
      
      try {
        await this.db.instantiate(bundle.mainModule);
      } catch (instantiateError) {
        console.warn('Failed to instantiate with pthread, trying without:', instantiateError);
        await this.db.instantiate(bundle.mainModule);
      }
      
      // Clean up worker URL
      URL.revokeObjectURL(worker_url);
      
      // Try to use OPFS for persistence, fallback to IndexedDB
      await this.initializePersistence();
      
      this.isInitialized = true;
      console.log('DuckDB WASM initialized successfully for location tracking');
    } catch (error) {
      console.error('Failed to initialize DuckDB WASM:', error);
      this.isInitialized = false;
      this.initPromise = null;
      throw error;
    }
  }

  private async initializePersistence(): Promise<void> {
    try {
      // Check OPFS support
      if ('navigator' in globalThis && 
          'storage' in navigator && 
          'getDirectory' in navigator.storage &&
          typeof navigator.storage.getDirectory === 'function') {
        console.log('🚀 OPFS is supported, attempting to use persistent database file');
        await this.initializeWithOPFS();
        this.useOPFS = true;
      } else {
        console.log('📦 OPFS not supported, using in-memory DuckDB with IndexedDB backup');
        await this.initializeWithMemoryAndIndexedDB();
        this.useOPFS = false;
      }
    } catch (error) {
      console.warn('Failed to initialize OPFS, falling back to IndexedDB:', error);
      await this.initializeWithMemoryAndIndexedDB();
      this.useOPFS = false;
    }
  }

  private async initializeWithOPFS(): Promise<void> {
    try {
      console.log('🚀 Initializing DuckDB WASM with OPFS support for location tracking');
      
      // Check if db.open method exists (for newer DuckDB versions)
      if (typeof (this.db as any).open === 'function') {
        try {
          await (this.db as any).open({
            path: `opfs://${this.dbFileName}`,
            accessMode: 1 // READ_WRITE
          });
          console.log('✅ Database opened with official OPFS API');
        } catch (openError) {
          console.log('Official open failed, trying without accessMode:', openError);
          await (this.db as any).open({
            path: `opfs://${this.dbFileName}`
          });
          console.log('✅ Database opened with simple OPFS path');
        }
      } else {
        throw new Error('db.open method not available in this DuckDB version');
      }
      
      // Connect to the OPFS database
      this.connection = await this.db!.connect();
      console.log('🔗 Connected to OPFS database');
      
      // Check if tables exist, if not create them
      try {
        const tableCheck = await this.connection.query(`
          SELECT table_name FROM information_schema.tables 
          WHERE table_name = 'location_history'
        `);
        
        const tables = tableCheck.toArray();
        console.log('📊 Existing tables:', tables);
        
        if (tables.length === 0) {
          console.log('📄 Creating new tables in OPFS database');
          await this.createTables();
          
          // Critical: Use CHECKPOINT to persist schema to OPFS
          await this.connection.query('CHECKPOINT');
          console.log('💾 Schema persisted to OPFS');
        } else {
          console.log('📊 Found existing tables in OPFS database');
        }
      } catch (tableError) {
        console.log('📄 Error checking tables, creating new ones:', tableError);
        await this.createTables();
        
        try {
          await this.connection.query('CHECKPOINT');
          console.log('💾 Schema persisted to OPFS');
        } catch (checkpointError) {
          console.warn('⚠️ CHECKPOINT failed:', checkpointError);
        }
      }
      
      console.log('✅ OPFS persistence initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize OPFS persistence:', error);
      throw error;
    }
  }

  private async initializeWithMemoryAndIndexedDB(): Promise<void> {
    // Open in-memory connection
    this.connection = await this.db!.connect();
    
    // Create tables
    await this.createTables();
    
    // Load existing data from IndexedDB backup
    await this.loadFromIndexedDBBackup();
    
    console.log('✅ In-memory + IndexedDB backup initialized');
  }

  private async saveToOPFS(): Promise<void> {
    if (!this.useOPFS || !this.connection) {
      return;
    }

    try {
      console.log('💾 Persisting changes to OPFS...');
      
      // Use official CHECKPOINT command to persist changes to OPFS
      await this.connection.query('CHECKPOINT');
      
      console.log('✅ Changes persisted to OPFS successfully');
    } catch (error) {
      console.warn('⚠️ Failed to persist to OPFS:', error);
    }
  }

  private async createTables(): Promise<void> {
    if (!this.connection) throw new Error('Database not initialized');

    // Create location history table
    await this.connection.query(`
      CREATE TABLE IF NOT EXISTS location_history (
        id VARCHAR PRIMARY KEY,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        description TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        image_data TEXT,
        analysis_mode VARCHAR NOT NULL,
        confidence_score DECIMAL(3, 2),
        source VARCHAR NOT NULL,
        weather_data JSON,
        nearby_places JSON
      )
    `);

    // Create indexes for faster queries
    await this.connection.query(`
      CREATE INDEX IF NOT EXISTS idx_location_history_timestamp 
      ON location_history(timestamp DESC)
    `);

    await this.connection.query(`
      CREATE INDEX IF NOT EXISTS idx_location_history_coordinates 
      ON location_history(latitude, longitude)
    `);

    await this.connection.query(`
      CREATE INDEX IF NOT EXISTS idx_location_history_source 
      ON location_history(source)
    `);
  }

  async saveLocationHistory(record: LocationHistoryRecord): Promise<void> {
    try {
      await this.initialize();
      if (!this.connection) throw new Error('Database not initialized');

      console.log('Saving location history to DuckDB:', {
        id: record.id,
        coordinates: [record.latitude, record.longitude],
        description: record.description.substring(0, 50) + '...',
        mode: record.analysis_mode,
        source: record.source
      });

      // Use string interpolation for DuckDB WASM compatibility
      const query = `
        INSERT INTO location_history (
          id, latitude, longitude, description, timestamp, 
          image_data, analysis_mode, confidence_score, source, 
          weather_data, nearby_places
        ) VALUES (
          '${record.id.replace(/'/g, "''")},
          ${record.latitude},
          ${record.longitude},
          '${record.description.replace(/'/g, "''")},
          '${record.timestamp}',
          ${record.image_data ? `'${record.image_data.replace(/'/g, "''")}'` : 'NULL'},
          '${record.analysis_mode}',
          ${record.confidence_score || 'NULL'},
          '${record.source}',
          '${JSON.stringify(record.weather_data || {}).replace(/'/g, "''")},
          '${JSON.stringify(record.nearby_places || []).replace(/'/g, "''")}
        )
      `;

      await this.connection.query(query);
      console.log('Successfully saved location history to DuckDB');
      
      // Save to persistent storage
      if (this.useOPFS) {
        await this.saveToOPFS();
      } else {
        await this.saveToIndexedDBBackup(record);
      }
      
    } catch (error) {
      console.error('Failed to save location history:', error);
      throw error;
    }
  }

  async getLocationHistory(limit = 50): Promise<LocationSummary[]> {
    await this.initialize();
    if (!this.connection) throw new Error('Database not initialized');

    try {
      const limitValue = Number(limit) || 50;
      const result = await this.connection.query(`
        SELECT 
          id,
          latitude,
          longitude,
          description,
          timestamp,
          analysis_mode,
          source
        FROM location_history 
        ORDER BY timestamp DESC 
        LIMIT ${limitValue}
      `);

      return result.toArray().map((row: any) => ({
        id: row.id,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        description: row.description,
        timestamp: row.timestamp,
        analysis_mode: row.analysis_mode,
        source: row.source
      }));
    } catch (error) {
      console.error('Failed to get location history:', error);
      throw error;
    }
  }

  async getLocationById(id: string): Promise<LocationHistoryRecord | null> {
    await this.initialize();
    if (!this.connection) throw new Error('Database not initialized');

    try {
      const result = await this.connection.query(`
        SELECT * FROM location_history WHERE id = '${id}'
      `);

      const rows = result.toArray();
      if (rows.length === 0) return null;

      const row = rows[0];
      return {
        id: row.id,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        description: row.description,
        timestamp: row.timestamp,
        image_data: row.image_data,
        analysis_mode: row.analysis_mode as 'basic' | 'function' | 'grounding' | 'image-search',
        confidence_score: row.confidence_score,
        source: row.source as 'camera' | 'upload',
        weather_data: row.weather_data ? JSON.parse(row.weather_data) : undefined,
        nearby_places: row.nearby_places ? JSON.parse(row.nearby_places) : []
      };
    } catch (error) {
      console.error('Failed to get location by ID:', error);
      throw error;
    }
  }

  async searchLocationHistory(searchTerm: string, limit = 20): Promise<LocationSummary[]> {
    await this.initialize();
    if (!this.connection) throw new Error('Database not initialized');

    try {
      const limitValue = Number(limit) || 20;
      const result = await this.connection.query(`
        SELECT 
          id,
          latitude,
          longitude,
          description,
          timestamp,
          analysis_mode,
          source
        FROM location_history 
        WHERE description ILIKE '%${searchTerm}%'
        ORDER BY timestamp DESC 
        LIMIT ${limitValue}
      `);

      return result.toArray().map((row: any) => ({
        id: row.id,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        description: row.description,
        timestamp: row.timestamp,
        analysis_mode: row.analysis_mode,
        source: row.source
      }));
    } catch (error) {
      console.error('Failed to search location history:', error);
      throw error;
    }
  }

  async deleteLocationHistory(id: string): Promise<void> {
    await this.initialize();
    if (!this.connection) throw new Error('Database not initialized');

    try {
      await this.connection.query(`
        DELETE FROM location_history WHERE id = '${id}'
      `);
      
      // Update persistent storage
      if (this.useOPFS) {
        await this.saveToOPFS();
      } else {
        await this.deleteFromIndexedDBBackup(id);
      }
      
    } catch (error) {
      console.error('Failed to delete location history:', error);
      throw error;
    }
  }

  async clearAllHistory(): Promise<void> {
    await this.initialize();
    if (!this.connection) throw new Error('Database not initialized');

    try {
      await this.connection.query(`DELETE FROM location_history`);
      
      // Update persistent storage
      if (this.useOPFS) {
        await this.saveToOPFS();
      } else {
        await this.saveAllToIndexedDBBackup([]);
      }
      
    } catch (error) {
      console.error('Failed to clear all location history:', error);
      throw error;
    }
  }

  async getLocationStatistics(): Promise<{
    totalLocations: number;
    cameraLocations: number;
    uploadedLocations: number;
    recentLocations: number;
  }> {
    await this.initialize();
    if (!this.connection) throw new Error('Database not initialized');

    try {
      const totalResult = await this.connection.query(`
        SELECT COUNT(*) as total FROM location_history
      `);

      const cameraResult = await this.connection.query(`
        SELECT COUNT(*) as total FROM location_history WHERE source = 'camera'
      `);

      const uploadResult = await this.connection.query(`
        SELECT COUNT(*) as total FROM location_history WHERE source = 'upload'
      `);

      // Calculate 7 days ago
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentResult = await this.connection.query(`
        SELECT COUNT(*) as total FROM location_history 
        WHERE timestamp > '${sevenDaysAgo.toISOString()}'
      `);

      const totalRows = totalResult.toArray();
      const cameraRows = cameraResult.toArray();
      const uploadRows = uploadResult.toArray();
      const recentRows = recentResult.toArray();

      return {
        totalLocations: totalRows.length > 0 ? totalRows[0].total : 0,
        cameraLocations: cameraRows.length > 0 ? cameraRows[0].total : 0,
        uploadedLocations: uploadRows.length > 0 ? uploadRows[0].total : 0,
        recentLocations: recentRows.length > 0 ? recentRows[0].total : 0
      };
    } catch (error) {
      console.error('Failed to get location statistics:', error);
      throw error;
    }
  }

  // IndexedDB backup methods (similar to original implementation)
  private async saveToIndexedDBBackup(record: LocationHistoryRecord): Promise<void> {
    try {
      const existingRecords = await this.getAllFromIndexedDBBackup();
      const filteredRecords = existingRecords.filter(r => r.id !== record.id);
      filteredRecords.push(record);
      await this.saveAllToIndexedDBBackup(filteredRecords);
      console.log('Saved location to IndexedDB backup:', record.id);
    } catch (error) {
      console.warn('Failed to save to IndexedDB backup:', error);
    }
  }

  private async loadFromIndexedDBBackup(): Promise<void> {
    try {
      if (!this.connection) return;
      
      const records = await this.getAllFromIndexedDBBackup();
      console.log(`Loading ${records.length} location records from IndexedDB backup`);
      
      for (const record of records) {
        try {
          const query = `
            INSERT INTO location_history (
              id, latitude, longitude, description, timestamp, 
              image_data, analysis_mode, confidence_score, source, 
              weather_data, nearby_places
            ) VALUES (
              '${record.id.replace(/'/g, "''")},
              ${record.latitude},
              ${record.longitude},
              '${record.description.replace(/'/g, "''")},
              '${record.timestamp}',
              ${record.image_data ? `'${record.image_data.replace(/'/g, "''")}'` : 'NULL'},
              '${record.analysis_mode}',
              ${record.confidence_score || 'NULL'},
              '${record.source}',
              '${JSON.stringify(record.weather_data || {}).replace(/'/g, "''")},
              '${JSON.stringify(record.nearby_places || []).replace(/'/g, "''")}
            )
          `;
          
          await this.connection.query(query);
        } catch (insertError) {
          console.warn('Failed to insert location record from backup:', record.id, insertError);
        }
      }
      
      console.log('Successfully loaded location data from IndexedDB backup');
    } catch (error) {
      console.warn('Failed to load from IndexedDB backup:', error);
    }
  }

  private async getAllFromIndexedDBBackup(): Promise<LocationHistoryRecord[]> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('LocationTrackerHistory', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('locationHistory')) {
          db.createObjectStore('locationHistory');
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['locationHistory'], 'readonly');
        const store = transaction.objectStore('locationHistory');
        const getRequest = store.get('records');
        
        getRequest.onsuccess = () => {
          resolve(getRequest.result || []);
        };
        
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  }

  private async saveAllToIndexedDBBackup(records: LocationHistoryRecord[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('LocationTrackerHistory', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('locationHistory')) {
          db.createObjectStore('locationHistory');
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['locationHistory'], 'readwrite');
        const store = transaction.objectStore('locationHistory');
        const putRequest = store.put(records, 'records');
        
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
    });
  }

  private async deleteFromIndexedDBBackup(id: string): Promise<void> {
    try {
      const existingRecords = await this.getAllFromIndexedDBBackup();
      const filteredRecords = existingRecords.filter(r => r.id !== id);
      await this.saveAllToIndexedDBBackup(filteredRecords);
      console.log('Deleted from IndexedDB backup:', id);
    } catch (error) {
      console.warn('Failed to delete from IndexedDB backup:', error);
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
    if (this.db) {
      await this.db.terminate();
      this.db = null;
    }
    this.isInitialized = false;
    this.initPromise = null;
  }
}

// Singleton instance
export const locationHistoryDB = new LocationHistoryDB();

// Global debug function for development
if (typeof window !== 'undefined') {
  (window as any).debugLocationDB = () => locationHistoryDB.getLocationStatistics();
}